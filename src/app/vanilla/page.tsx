"use client";

import React, { useEffect, useRef, useState } from "react";

interface NetworkNode {
    id: string;
    label: string;
    type: "router" | "switch" | "server" | "client" | "group";
    parent?: string; // 부모 그룹 ID
    x: number;
    y: number;
    info: string;
    isMainNode?: boolean;
    details?: any;
    status?: "up" | "down" | "warning";
    cpu?: number; // 0-100%
    memory?: number; // 0-100%
    temperature?: number;
    ports?: Array<{ name: string; status: "up" | "down"; speed: string; vlan?: number }>;
    // 그룹 노드용 속성
    children?: Set<string>; // 자식 노드 ID들
    width?: number;
    height?: number;
}

interface NetworkEdge {
    id: string;
    source: string;
    target: string;
    status?: "up" | "down" | "warning";
    bandwidth?: string;
    sourcePort?: string;
    targetPort?: string;
    vlan?: number;
    traffic?: number; // 0-100%
}

class NetworkRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    public nodes: Map<string, NetworkNode> = new Map();
    private edges: NetworkEdge[] = [];
    private camera = { x: 0, y: 0, zoom: 1 };
    private isDragging = false;
    private dragTarget: NetworkNode | null = null;
    private dragOffset = { x: 0, y: 0 };
    private isViewDragging = false;
    private lastMousePos = { x: 0, y: 0 };
    private hoveredNode: NetworkNode | null = null;
    private selectedNode: NetworkNode | null = null;
    private highlightedPaths: Set<string> = new Set(); // 하이라이트된 엣지 ID들
    private isCollapsed = false;
    private isAutoCollapse = true;
    private zoomThreshold = 0.7;

    // 노드 색상
    private nodeColors = {
        router: "#e74c3c",
        switch: "#3498db",
        server: "#2ecc71",
        client: "#f39c12",
        group: "#95a5a6",
    };

    // VLAN 색상 (브로드캐스트 도메인별 구분)
    private vlanColors = {
        1: "#8e44ad", // 기본 VLAN - 보라색
        10: "#2980b9", // 관리 VLAN - 파란색
        20: "#27ae60", // 데이터 VLAN - 녹색
        30: "#f39c12", // 게스트 VLAN - 주황색
        40: "#e74c3c", // DMZ VLAN - 빨간색
        50: "#16a085", // VoIP VLAN - 청록색
    };

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw new Error("Canvas 2D context를 가져올 수 없습니다.");
        }
        this.ctx = ctx;
        this.setupEventListeners();
        this.resize();

        // 초기 줌 레벨 설정
        this.camera.zoom = 0.8;
    }

    private setupEventListeners() {
        // 마우스 이벤트
        this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
        this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
        this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
        this.canvas.addEventListener("wheel", this.handleWheel.bind(this));
        this.canvas.addEventListener("click", this.handleClick.bind(this));

        // 윈도우 리사이즈
        window.addEventListener("resize", this.resize.bind(this));
    }

    private resize() {
        if (!this.canvas.parentElement) return;

        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + "px";
        this.canvas.style.height = rect.height + "px";

        // 컨텍스트 스케일 재설정
        this.ctx.scale(dpr, dpr);

        // 카메라 중심점 재조정
        this.camera.x = rect.width / 2;
        this.camera.y = rect.height / 2;
    }

    private screenToWorld(screenX: number, screenY: number) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (screenX - rect.left - this.camera.x) / this.camera.zoom,
            y: (screenY - rect.top - this.camera.y) / this.camera.zoom,
        };
    }

    private worldToScreen(worldX: number, worldY: number) {
        return {
            x: worldX * this.camera.zoom + this.camera.x,
            y: worldY * this.camera.zoom + this.camera.y,
        };
    }

    private handleMouseDown(event: MouseEvent) {
        const worldPos = this.screenToWorld(event.clientX, event.clientY);
        const hitNode = this.getNodeAt(worldPos.x, worldPos.y);

        if (hitNode && !event.shiftKey) {
            // 노드 드래그 시작 (그룹 노드 포함)
            this.isDragging = true;
            this.dragTarget = hitNode;
            this.dragOffset = {
                x: worldPos.x - hitNode.x,
                y: worldPos.y - hitNode.y,
            };
            this.canvas.style.cursor = "grabbing";
        } else {
            // 뷰 드래그 시작
            this.isViewDragging = true;
            this.lastMousePos = { x: event.clientX, y: event.clientY };
            this.canvas.style.cursor = "grabbing";
        }
    }

    private handleMouseMove(event: MouseEvent) {
        const worldPos = this.screenToWorld(event.clientX, event.clientY);

        if (this.isDragging && this.dragTarget) {
            const newX = worldPos.x - this.dragOffset.x;
            const newY = worldPos.y - this.dragOffset.y;

            if (this.dragTarget.type === "group") {
                // 그룹 노드 드래그 - 자식들도 함께 이동
                const deltaX = newX - this.dragTarget.x;
                const deltaY = newY - this.dragTarget.y;

                this.dragTarget.x = newX;
                this.dragTarget.y = newY;

                // 자식 노드들도 함께 이동
                if (this.dragTarget.children) {
                    this.dragTarget.children.forEach(childId => {
                        const child = this.nodes.get(childId);
                        if (child) {
                            child.x += deltaX;
                            child.y += deltaY;
                        }
                    });
                }

                // 그룹 경계 재계산
                this.updateGroupBounds(this.dragTarget);
            } else {
                // 일반 노드 드래그
                this.dragTarget.x = newX;
                this.dragTarget.y = newY;

                // 부모 그룹 경계 업데이트
                if (this.dragTarget.parent) {
                    const parentGroup = this.nodes.get(this.dragTarget.parent);
                    if (parentGroup && parentGroup.type === "group") {
                        this.updateGroupBounds(parentGroup);
                    }
                }
            }
        } else if (this.isViewDragging) {
            // 뷰 드래그
            const deltaX = event.clientX - this.lastMousePos.x;
            const deltaY = event.clientY - this.lastMousePos.y;

            this.camera.x += deltaX;
            this.camera.y += deltaY;

            this.lastMousePos = { x: event.clientX, y: event.clientY };
        } else {
            // 호버 처리
            const hitNode = this.getNodeAt(worldPos.x, worldPos.y);
            if (hitNode !== this.hoveredNode) {
                this.hoveredNode = hitNode;
                this.canvas.style.cursor = hitNode ? "pointer" : "default";
            }
        }
    }

    private handleMouseUp(event: MouseEvent) {
        this.isDragging = false;
        this.dragTarget = null;
        this.isViewDragging = false;
        this.canvas.style.cursor = "default";
    }

    private handleWheel(event: WheelEvent) {
        event.preventDefault();

        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        const mousePos = this.screenToWorld(event.clientX, event.clientY);

        // 마우스 위치를 중심으로 줌
        this.camera.x -= mousePos.x * this.camera.zoom * (zoomFactor - 1);
        this.camera.y -= mousePos.y * this.camera.zoom * (zoomFactor - 1);
        this.camera.zoom *= zoomFactor;

        // 줌 제한
        this.camera.zoom = Math.max(0.1, Math.min(3, this.camera.zoom));

        // 자동 축소 처리 (cytoscape와 동일한 로직)
        if (this.isAutoCollapse) {
            const shouldCollapse = this.camera.zoom < this.zoomThreshold;
            if (shouldCollapse !== this.isCollapsed) {
                this.isCollapsed = shouldCollapse;
            }
        }
    }

    private handleClick(event: MouseEvent) {
        const worldPos = this.screenToWorld(event.clientX, event.clientY);
        const hitNode = this.getNodeAt(worldPos.x, worldPos.y);

        if (hitNode) {
            this.selectedNode = hitNode;
            this.updateHighlightedPaths(hitNode);

            // Ctrl+클릭으로 노드 포커스
            if (event.ctrlKey || event.metaKey) {
                this.focusOnNode(hitNode);
            }
        } else {
            this.selectedNode = null;
            this.highlightedPaths.clear();
        }
    }

    private getNodeAt(x: number, y: number): NetworkNode | null {
        // 그룹 노드부터 먼저 체크 (더 큰 영역)
        for (const node of this.nodes.values()) {
            if (node.type === "group" && node.width && node.height) {
                // 그룹의 헤더 영역 체크 (드래그 가능한 영역)
                const headerHeight = 40;
                if (
                    x >= node.x - node.width / 2 &&
                    x <= node.x + node.width / 2 &&
                    y >= node.y - node.height / 2 &&
                    y <= node.y - node.height / 2 + headerHeight
                ) {
                    return node;
                }
            }
        }
        
        // 일반 노드 체크
        for (const node of this.nodes.values()) {
            if (node.type !== "group") {
                const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
                if (distance < 30) {
                    return node;
                }
            }
        }
        return null;
    }




    private updateHighlightedPaths(selectedNode: NetworkNode) {
        this.highlightedPaths.clear();

        // 선택된 노드와 연결된 모든 엣지 찾기
        this.edges.forEach((edge) => {
            if (edge.source === selectedNode.id || edge.target === selectedNode.id) {
                this.highlightedPaths.add(edge.id);
            }
        });
    }

    private focusOnNode(node: NetworkNode) {
        const dpr = window.devicePixelRatio || 1;
        const centerX = this.canvas.width / (2 * dpr);
        const centerY = this.canvas.height / (2 * dpr);

        const targetX = centerX - node.x * this.camera.zoom;
        const targetY = centerY - node.y * this.camera.zoom;

        // 부드러운 애니메이션
        this.animateCamera(targetX, targetY, 1.5);
    }

    private animateCamera(targetX: number, targetY: number, targetZoom: number) {
        const startX = this.camera.x;
        const startY = this.camera.y;
        const startZoom = this.camera.zoom;
        const duration = 1000;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 이징 함수
            const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
            const easedProgress = easeInOut(progress);

            this.camera.x = startX + (targetX - startX) * easedProgress;
            this.camera.y = startY + (targetY - startY) * easedProgress;
            this.camera.zoom = startZoom + (targetZoom - startZoom) * easedProgress;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    private drawNode(node: NetworkNode) {
        // 축소 모드에서 메인 노드가 아니면 그리지 않음 (cytoscape 로직과 동일)
        if (this.isCollapsed && !node.isMainNode) {
            return;
        }


        const screenPos = this.worldToScreen(node.x, node.y);
        const size = 25 * this.camera.zoom;

        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);

        // 노드 색상
        this.ctx.fillStyle = this.nodeColors[node.type];
        this.ctx.strokeStyle = "#333";
        this.ctx.lineWidth = 2;

        // 상태에 따른 색상 조정
        if (node.status === "down") {
            this.ctx.fillStyle = "#95a5a6"; // 회색
            this.ctx.strokeStyle = "#e74c3c";
        } else if (node.status === "warning") {
            this.ctx.strokeStyle = "#f39c12";
        } else if (node.status === "up") {
            this.ctx.strokeStyle = "#27ae60";
        }

        // 호버 효과
        if (node === this.hoveredNode) {
            this.ctx.shadowColor = "rgba(0,0,0,0.3)";
            this.ctx.shadowBlur = 10;
        }

        // 선택 효과
        if (node === this.selectedNode) {
            this.ctx.strokeStyle = "#9b59b6";
            this.ctx.lineWidth = 4;
        }

        // 경로 하이라이트 시 연결되지 않은 노드는 투명도 낮춤
        if (this.selectedNode && this.selectedNode !== node) {
            const isConnected = this.edges.some(
                (edge) =>
                    (edge.source === this.selectedNode!.id && edge.target === node.id) ||
                    (edge.target === this.selectedNode!.id && edge.source === node.id)
            );

            if (!isConnected) {
                this.ctx.globalAlpha = 0.3;
            }
        }

        // 노드 형태별 렌더링
        switch (node.type) {
            case "router":
                // 둥근 사각형
                this.drawRoundedRect(-size / 2, -size / 2, size, size, 5);
                break;
            case "switch":
                // 사각형
                this.ctx.fillRect(-size / 2, -size / 2, size, size);
                this.ctx.strokeRect(-size / 2, -size / 2, size, size);
                break;
            case "server":
                // 세로 사각형
                this.ctx.fillRect(-size / 3, -size / 2, (size * 2) / 3, size);
                this.ctx.strokeRect(-size / 3, -size / 2, (size * 2) / 3, size);
                break;
            case "client":
                // 원형
                this.ctx.beginPath();
                this.ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
                break;
        }

        // 메인 노드 테두리
        if (node.isMainNode) {
            this.ctx.strokeStyle = "#fff";
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
        }

        // 레이블
        if (this.camera.zoom > 0.5) {
            this.ctx.fillStyle = "#333";
            this.ctx.font = `${12 * this.camera.zoom}px Arial`;
            this.ctx.textAlign = "center";
            this.ctx.fillText(node.label, 0, size + 15 * this.camera.zoom);
        }

        // 상태 인디케이터 (우상단 원형)
        if (node.status) {
            const indicatorSize = 6 * this.camera.zoom;
            const indicatorX = size / 2 - indicatorSize;
            const indicatorY = -size / 2 + indicatorSize;

            this.ctx.beginPath();
            this.ctx.arc(indicatorX, indicatorY, indicatorSize, 0, Math.PI * 2);

            if (node.status === "up") {
                this.ctx.fillStyle = "#27ae60";
            } else if (node.status === "down") {
                this.ctx.fillStyle = "#e74c3c";
            } else if (node.status === "warning") {
                this.ctx.fillStyle = "#f39c12";
            }

            this.ctx.fill();
            this.ctx.strokeStyle = "#fff";
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }

        // CPU/메모리 상태 바 (확대 시에만 표시)
        if (this.camera.zoom > 0.7 && (node.cpu !== undefined || node.memory !== undefined)) {
            this.drawNodeMetrics(node, size);
        }

        // 투명도 복구
        this.ctx.globalAlpha = 1.0;

        this.ctx.restore();
    }

    private drawNodeMetrics(node: NetworkNode, nodeSize: number) {
        const barWidth = nodeSize * 0.8;
        const barHeight = 4 * this.camera.zoom;
        const startY = nodeSize / 2 + 20 * this.camera.zoom;

        // CPU 사용률
        if (node.cpu !== undefined) {
            // 배경
            this.ctx.fillStyle = "rgba(0,0,0,0.2)";
            this.ctx.fillRect(-barWidth / 2, startY, barWidth, barHeight);

            // CPU 바
            const cpuWidth = (barWidth * node.cpu) / 100;
            let cpuColor = "#27ae60";
            if (node.cpu > 80) cpuColor = "#e74c3c";
            else if (node.cpu > 60) cpuColor = "#f39c12";

            this.ctx.fillStyle = cpuColor;
            this.ctx.fillRect(-barWidth / 2, startY, cpuWidth, barHeight);

            // CPU 레이블
            this.ctx.fillStyle = "#333";
            this.ctx.font = `${8 * this.camera.zoom}px Arial`;
            this.ctx.textAlign = "left";
            this.ctx.fillText(`CPU: ${node.cpu}%`, -barWidth / 2, startY - 2 * this.camera.zoom);
        }

        // 메모리 사용률
        if (node.memory !== undefined) {
            const memoryY = startY + (node.cpu !== undefined ? 15 * this.camera.zoom : 0);

            // 배경
            this.ctx.fillStyle = "rgba(0,0,0,0.2)";
            this.ctx.fillRect(-barWidth / 2, memoryY, barWidth, barHeight);

            // 메모리 바
            const memoryWidth = (barWidth * node.memory) / 100;
            let memoryColor = "#3498db";
            if (node.memory > 80) memoryColor = "#e74c3c";
            else if (node.memory > 60) memoryColor = "#f39c12";

            this.ctx.fillStyle = memoryColor;
            this.ctx.fillRect(-barWidth / 2, memoryY, memoryWidth, barHeight);

            // 메모리 레이블
            this.ctx.fillStyle = "#333";
            this.ctx.font = `${8 * this.camera.zoom}px Arial`;
            this.ctx.textAlign = "left";
            this.ctx.fillText(
                `MEM: ${node.memory}%`,
                -barWidth / 2,
                memoryY - 2 * this.camera.zoom
            );
        }
    }

    private drawRoundedRect(x: number, y: number, width: number, height: number, radius: number) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
    }

    private drawEdge(edge: NetworkEdge) {
        const sourceNode = this.nodes.get(edge.source);
        const targetNode = this.nodes.get(edge.target);

        if (!sourceNode || !targetNode) return;

        // 축소 모드에서 숨겨진 노드와 연결된 엣지는 그리지 않음
        if (this.isCollapsed) {
            if (!sourceNode.isMainNode || !targetNode.isMainNode) {
                return;
            }
        }


        const sourcePos = this.worldToScreen(sourceNode.x, sourceNode.y);
        const targetPos = this.worldToScreen(targetNode.x, targetNode.y);

        // 직각 연결선 (Manhattan routing)
        const points = this.calculateManhattanPath(sourcePos, targetPos);

        // 연결선 색상 (VLAN과 상태에 따라)
        let lineColor = "#666";
        let lineWidth = 3;
        let isHighlighted = this.highlightedPaths.has(edge.id);

        // 하이라이트되지 않은 연결선은 투명도 낮춤
        if (this.selectedNode && !isHighlighted) {
            lineColor = "rgba(150, 150, 150, 0.3)";
            lineWidth = 1;
        } else {
            // VLAN 색상 우선 적용
            if (edge.vlan && this.vlanColors[edge.vlan as keyof typeof this.vlanColors]) {
                lineColor = this.vlanColors[edge.vlan as keyof typeof this.vlanColors];
                lineWidth = 4; // VLAN 연결은 조금 더 굵게
            }

            // 상태가 down이거나 warning인 경우 상태 색상으로 오버라이드
            if (edge.status === "down") {
                lineColor = "#e74c3c";
                lineWidth = 2;
            } else if (edge.status === "warning") {
                lineColor = "#f39c12";
                lineWidth = 3;
            }

            // 하이라이트된 연결선은 더 굵게
            if (isHighlighted) {
                lineWidth += 2;
            }
        }

        // 트래픽 애니메이션을 위한 그라데이션
        if (edge.traffic && edge.traffic > 0) {
            const gradient = this.ctx.createLinearGradient(
                sourcePos.x,
                sourcePos.y,
                targetPos.x,
                targetPos.y
            );
            gradient.addColorStop(0, lineColor);
            gradient.addColorStop(0.5, "#3498db");
            gradient.addColorStop(1, lineColor);
            lineColor = gradient as any;
        }

        this.ctx.strokeStyle = lineColor;
        this.ctx.lineWidth = lineWidth * this.camera.zoom;
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";

        // 경로 그리기
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }
        this.ctx.stroke();

        // 화살표 그리기 (마지막 세그먼트 방향)
        if (points.length > 1) {
            const lastPoint = points[points.length - 1];
            const secondLastPoint = points[points.length - 2];
            const angle = Math.atan2(
                lastPoint.y - secondLastPoint.y,
                lastPoint.x - secondLastPoint.x
            );

            this.drawArrow(lastPoint, angle, lineColor === "#e74c3c" ? "#e74c3c" : "#666");
        }

        // 포트 정보 표시
        if (this.camera.zoom > 0.6 && (edge.sourcePort || edge.targetPort)) {
            this.drawPortLabels(edge, sourcePos, targetPos);
        }

        // VLAN 정보 표시
        if (this.camera.zoom > 0.5 && edge.vlan) {
            this.drawVlanLabel(edge, points);
        }

        // 트래픽 표시
        if (edge.traffic && edge.traffic > 50 && this.camera.zoom > 0.5) {
            this.drawTrafficIndicator(points, edge.traffic);
        }
    }

    private calculateManhattanPath(start: { x: number; y: number }, end: { x: number; y: number }) {
        const points = [];
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        const offset = 30 * this.camera.zoom;

        // 시작점
        points.push({ x: start.x, y: start.y });

        // 거리에 따라 경로 결정
        const deltaX = Math.abs(end.x - start.x);
        const deltaY = Math.abs(end.y - start.y);

        if (deltaX > deltaY) {
            // 수평 우선
            if (Math.abs(start.y - end.y) > 50) {
                points.push({ x: midX, y: start.y });
                points.push({ x: midX, y: end.y });
            }
        } else {
            // 수직 우선
            if (Math.abs(start.x - end.x) > 50) {
                points.push({ x: start.x, y: midY });
                points.push({ x: end.x, y: midY });
            }
        }

        // 끝점
        points.push({ x: end.x, y: end.y });

        return points;
    }

    private drawArrow(position: { x: number; y: number }, angle: number, color: string) {
        const arrowSize = 8 * this.camera.zoom;

        this.ctx.save();
        this.ctx.translate(position.x, position.y);
        this.ctx.rotate(angle);
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(-arrowSize, -arrowSize / 2);
        this.ctx.lineTo(-arrowSize, arrowSize / 2);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
    }

    private drawPortLabels(
        edge: NetworkEdge,
        sourcePos: { x: number; y: number },
        targetPos: { x: number; y: number }
    ) {
        this.ctx.font = `${10 * this.camera.zoom}px Arial`;
        this.ctx.fillStyle = "#333";
        this.ctx.textAlign = "center";

        if (edge.sourcePort) {
            this.ctx.fillText(edge.sourcePort, sourcePos.x, sourcePos.y - 35 * this.camera.zoom);
        }

        if (edge.targetPort) {
            this.ctx.fillText(edge.targetPort, targetPos.x, targetPos.y - 35 * this.camera.zoom);
        }
    }

    private drawVlanLabel(edge: NetworkEdge, points: Array<{ x: number; y: number }>) {
        if (points.length < 2 || !edge.vlan) return;

        // 연결선 중간 지점에 VLAN 표시
        const midIndex = Math.floor(points.length / 2);
        const midPoint = points[midIndex];

        // VLAN 배지 그리기
        const badgeWidth = 45 * this.camera.zoom;
        const badgeHeight = 16 * this.camera.zoom;
        const badgeX = midPoint.x - badgeWidth / 2;
        const badgeY = midPoint.y + 15 * this.camera.zoom;

        // 배지 배경
        const vlanColor = this.vlanColors[edge.vlan as keyof typeof this.vlanColors] || "#666";
        this.ctx.fillStyle = vlanColor;
        this.ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);

        // 배지 테두리
        this.ctx.strokeStyle = "#fff";
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(badgeX, badgeY, badgeWidth, badgeHeight);

        // VLAN 텍스트
        this.ctx.font = `bold ${9 * this.camera.zoom}px Arial`;
        this.ctx.fillStyle = "#fff";
        this.ctx.textAlign = "center";
        this.ctx.fillText(`VLAN ${edge.vlan}`, midPoint.x, badgeY + 12 * this.camera.zoom);
    }

    private drawTrafficIndicator(points: Array<{ x: number; y: number }>, traffic: number) {
        if (points.length < 2) return;

        // 중간 지점에 트래픽 표시
        const midIndex = Math.floor(points.length / 2);
        const midPoint = points[midIndex];

        // 트래픽 바
        const barWidth = 30 * this.camera.zoom;
        const barHeight = 6 * this.camera.zoom;
        const fillWidth = (barWidth * traffic) / 100;

        // 배경
        this.ctx.fillStyle = "rgba(0,0,0,0.3)";
        this.ctx.fillRect(
            midPoint.x - barWidth / 2,
            midPoint.y - 20 * this.camera.zoom,
            barWidth,
            barHeight
        );

        // 트래픽 레벨
        let trafficColor = "#27ae60";
        if (traffic > 80) trafficColor = "#e74c3c";
        else if (traffic > 60) trafficColor = "#f39c12";

        this.ctx.fillStyle = trafficColor;
        this.ctx.fillRect(
            midPoint.x - barWidth / 2,
            midPoint.y - 20 * this.camera.zoom,
            fillWidth,
            barHeight
        );

        // 퍼센트 텍스트
        this.ctx.font = `${8 * this.camera.zoom}px Arial`;
        this.ctx.fillStyle = "#333";
        this.ctx.textAlign = "center";
        this.ctx.fillText(`${traffic}%`, midPoint.x, midPoint.y - 25 * this.camera.zoom);
    }

    private drawGroups() {
        // 그룹 노드들만 필터링해서 그리기
        this.nodes.forEach((node) => {
            if (node.type === "group") {
                this.drawGroupNode(node);
            }
        });
    }

    private drawGroupNode(groupNode: NetworkNode) {
        if (!groupNode.width || !groupNode.height) return;

        const centerScreen = this.worldToScreen(groupNode.x, groupNode.y);
        const width = groupNode.width * this.camera.zoom;
        const height = groupNode.height * this.camera.zoom;
        
        const screenPos = {
            x: centerScreen.x - width / 2,
            y: centerScreen.y - height / 2,
        };

        // 그룹별 색상 지정
        const groupColors = {
            group1: { bg: "rgba(231, 76, 60, 0.1)", border: "#e74c3c" },
            group2: { bg: "rgba(52, 152, 219, 0.1)", border: "#3498db" },
            group3: { bg: "rgba(46, 204, 113, 0.1)", border: "#2ecc71" },
        };
        
        const colors = groupColors[groupNode.id as keyof typeof groupColors] || 
                      { bg: "rgba(150, 150, 150, 0.1)", border: "#999" };

        // 그룹 배경
        this.ctx.fillStyle = colors.bg;
        this.ctx.fillRect(screenPos.x, screenPos.y, width, height);

        // 그룹 테두리
        this.ctx.strokeStyle = colors.border;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 5]);
        this.ctx.strokeRect(screenPos.x, screenPos.y, width, height);
        this.ctx.setLineDash([]);

        // 헤더 배경
        if (this.camera.zoom > 0.4) {
            const headerHeight = 40 * this.camera.zoom;
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            this.ctx.fillRect(screenPos.x, screenPos.y, width, headerHeight);

            // 헤더 테두리
            this.ctx.strokeStyle = colors.border;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(screenPos.x, screenPos.y, width, headerHeight);

            // 그룹 레이블
            this.ctx.fillStyle = "#333";
            this.ctx.font = `bold ${Math.max(14, 16 * this.camera.zoom)}px Arial`;
            this.ctx.textAlign = "left";
            this.ctx.fillText(
                groupNode.label,
                screenPos.x + 15 * this.camera.zoom,
                screenPos.y + 25 * this.camera.zoom
            );

            // 자식 노드 개수 표시
            if (groupNode.children && groupNode.children.size > 0) {
                this.ctx.fillStyle = "#666";
                this.ctx.font = `${Math.max(10, 12 * this.camera.zoom)}px Arial`;
                this.ctx.textAlign = "right";
                this.ctx.fillText(
                    `${groupNode.children.size} 노드`,
                    screenPos.x + width - 15 * this.camera.zoom,
                    screenPos.y + 25 * this.camera.zoom
                );
            }
        }
    }

    public addNode(node: NetworkNode) {
        this.nodes.set(node.id, node);
        
        // 부모-자식 관계 설정
        if (node.parent) {
            const parent = this.nodes.get(node.parent);
            if (parent && parent.type === "group") {
                if (!parent.children) parent.children = new Set();
                parent.children.add(node.id);
            }
        }
        
        // 그룹 노드인 경우 초기 설정
        if (node.type === "group") {
            node.children = node.children || new Set();
            this.updateGroupBounds(node);
        }
    }

    public addEdge(edge: NetworkEdge) {
        this.edges.push(edge);
    }

    public updateGroupBounds(groupNode: NetworkNode) {
        if (groupNode.type !== "group" || !groupNode.children || groupNode.children.size === 0) {
            groupNode.width = 200;
            groupNode.height = 100;
            return;
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let hasChildren = false;

        // 자식 노드들의 경계 계산
        groupNode.children.forEach(childId => {
            const child = this.nodes.get(childId);
            if (child) {
                hasChildren = true;
                minX = Math.min(minX, child.x - 25);
                maxX = Math.max(maxX, child.x + 25);
                minY = Math.min(minY, child.y - 25);
                maxY = Math.max(maxY, child.y + 25);
            }
        });

        if (hasChildren) {
            const padding = 50;
            groupNode.width = Math.max(200, maxX - minX + padding * 2);
            groupNode.height = Math.max(100, maxY - minY + padding * 2);
            
            // 그룹 중심점을 자식들의 중심으로 조정
            groupNode.x = (minX + maxX) / 2;
            groupNode.y = (minY + maxY) / 2;
        } else {
            groupNode.width = 200;
            groupNode.height = 100;
        }
    }

    private animationId: number | null = null;
    private lastStatusUpdate = 0;
    private statusUpdateInterval = 3000; // 3초마다 상태 업데이트

    public render() {
        // 실시간 상태 업데이트 시뮬레이션
        const now = Date.now();
        if (now - this.lastStatusUpdate > this.statusUpdateInterval) {
            this.updateNetworkStatus();
            this.lastStatusUpdate = now;
        }

        // 캔버스 클리어
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 배경
        this.ctx.fillStyle = "#f8f9fa";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 그룹 그리기
        this.drawGroups();

        // 엣지 그리기
        this.edges.forEach((edge) => this.drawEdge(edge));

        // 노드 그리기
        this.nodes.forEach((node) => this.drawNode(node));

        // 다음 프레임 요청
        this.animationId = requestAnimationFrame(() => this.render());
    }

    private updateNetworkStatus() {
        // 노드 상태 시뮬레이션 업데이트
        this.nodes.forEach((node) => {
            // CPU 사용률을 랜덤하게 변경 (±5% 범위)
            if (node.cpu !== undefined) {
                const delta = (Math.random() - 0.5) * 10;
                node.cpu = Math.max(0, Math.min(100, node.cpu + delta));
            }

            // 메모리 사용률을 랜덤하게 변경 (±3% 범위)
            if (node.memory !== undefined) {
                const delta = (Math.random() - 0.5) * 6;
                node.memory = Math.max(0, Math.min(100, node.memory + delta));
            }

            // 온도 시뮬레이션 (±2도 범위)
            if (node.temperature !== undefined) {
                const delta = (Math.random() - 0.5) * 4;
                node.temperature = Math.max(25, Math.min(70, node.temperature + delta));
            }
        });

        // 엣지 트래픽 시뮬레이션 업데이트
        this.edges.forEach((edge) => {
            if (edge.traffic !== undefined && edge.status === "up") {
                // 트래픽을 랜덤하게 변경 (±10% 범위)
                const delta = (Math.random() - 0.5) * 20;
                edge.traffic = Math.max(0, Math.min(100, edge.traffic + delta));
            }
        });
    }

    public stopRendering() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    public getHoveredNode() {
        return this.hoveredNode;
    }

    public getSelectedNode() {
        return this.selectedNode;
    }

    public getCurrentZoom() {
        return this.camera.zoom;
    }

    public getIsCollapsed() {
        return this.isCollapsed;
    }

    public getIsAutoCollapse() {
        return this.isAutoCollapse;
    }

    public setAutoCollapse(enabled: boolean) {
        this.isAutoCollapse = enabled;
        if (enabled) {
            // 자동 모드로 전환 시 현재 줌에 따라 상태 설정
            const shouldCollapse = this.camera.zoom < this.zoomThreshold;
            this.isCollapsed = shouldCollapse;
        }
    }

    public toggleCollapse() {
        if (!this.isAutoCollapse) {
            this.isCollapsed = !this.isCollapsed;
        }
    }
}

function VanillaPage() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<NetworkRenderer | null>(null);
    const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);
    const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [currentZoom, setCurrentZoom] = useState(0.8);
    const [isCollapsed, setIsCollapsed] = useState(false); // 0.8 줌은 0.7 이상이므로 전체 보기
    const [isAutoCollapse, setIsAutoCollapse] = useState(true);

    useEffect(() => {
        if (!canvasRef.current) return;

        const renderer = new NetworkRenderer(canvasRef.current);
        rendererRef.current = renderer;

        // 네트워크 데이터 추가 (Compound Node 구조)
        const networkData = {
            nodes: [
                // 그룹 노드들 먼저 추가
                {
                    id: "group1",
                    label: "Core Network", 
                    type: "group" as const,
                    x: 0,
                    y: 0,
                    info: "Core network infrastructure containing main routers",
                },
                {
                    id: "group2",
                    label: "Branch A",
                    type: "group" as const, 
                    x: -500,
                    y: -200,
                    info: "Branch A network segment with local services",
                },
                {
                    id: "group3", 
                    label: "Branch B",
                    type: "group" as const,
                    x: 300,
                    y: -200, 
                    info: "Branch B network segment with client devices",
                },

                // Group 1 자식 노드들
                {
                    id: "router1",
                    label: "Router 1", 
                    type: "router" as const,
                    parent: "group1",
                    x: 0,
                    y: -50,
                    info: "Main core router - 10.0.0.1\nUptime: 99.9%\nTraffic: 1.2 Gbps",
                    isMainNode: true,
                    status: "up" as const,
                    cpu: 15,
                    memory: 45,
                    temperature: 45,
                    ports: [
                        { name: "Gi0/0/0", status: "up" as const, speed: "1Gbps", vlan: 1 },
                        { name: "Gi0/0/1", status: "up" as const, speed: "1Gbps", vlan: 10 },
                        { name: "Gi0/0/2", status: "down" as const, speed: "1Gbps", vlan: 20 },
                    ],
                },
                {
                    id: "router2",
                    label: "Router 2",
                    type: "router" as const,
                    parent: "group1",
                    x: -80,
                    y: 50,
                    info: "Secondary core router - 10.0.0.2\nUptime: 99.8%\nTraffic: 800 Mbps",
                    isMainNode: false,
                    status: "up" as const,
                    cpu: 22,
                    memory: 38,
                    temperature: 42,
                },
                {
                    id: "router3",
                    label: "Router 3",
                    type: "router" as const,
                    parent: "group1",
                    x: 80,
                    y: 50,
                    info: "Backup core router - 10.0.0.3\nUptime: 99.7%\nTraffic: 200 Mbps",
                    isMainNode: false,
                    status: "warning" as const,
                    cpu: 8,
                    memory: 25,
                    temperature: 50,
                },

                // Group 2 자식 노드들
                {
                    id: "switch1",
                    label: "Switch 1",
                    type: "switch" as const,
                    parent: "group2",
                    x: -500,
                    y: -250,
                    info: "Branch A switch - 10.1.0.1\nPorts: 24\nVLANs: 5",
                    isMainNode: true,
                    status: "up" as const,
                    cpu: 12,
                    memory: 35,
                    ports: [
                        { name: "Fa0/1", status: "up" as const, speed: "100Mbps", vlan: 10 },
                        { name: "Fa0/2", status: "up" as const, speed: "100Mbps", vlan: 20 },
                    ],
                },
                {
                    id: "server1",
                    label: "Server 1",
                    type: "server" as const,
                    parent: "group2",
                    x: -550,
                    y: -180,
                    info: "File server - 10.1.0.10\nOS: Ubuntu 22.04\nCPU: 85%\nRAM: 12GB/16GB",
                    isMainNode: false,
                    status: "up" as const,
                    cpu: 85,
                    memory: 75,
                    temperature: 38,
                },
                {
                    id: "client1",
                    label: "Client 1",
                    type: "client" as const,
                    parent: "group2",
                    x: -450,
                    y: -180,
                    info: "Workstation 1 - 10.1.0.101\nOS: Windows 11\nUser: Alice",
                    isMainNode: false,
                    status: "up" as const,
                    cpu: 45,
                    memory: 60,
                },
                {
                    id: "client2",
                    label: "Client 2",
                    type: "client" as const,
                    parent: "group2",
                    x: -500,
                    y: -130,
                    info: "Workstation 2 - 10.1.0.102\nOS: Windows 11\nUser: Bob",
                    isMainNode: false,
                    status: "down" as const,
                    cpu: 0,
                    memory: 0,
                },

                // Group 3 자식 노드들
                {
                    id: "switch2",
                    label: "Switch 2",
                    type: "switch" as const,
                    parent: "group3",
                    x: 300,
                    y: -250,
                    info: "Branch B switch - 10.2.0.1\nPorts: 16\nVLANs: 3",
                    isMainNode: true,
                    status: "up" as const,
                    cpu: 8,
                    memory: 28,
                },
                {
                    id: "server2",
                    label: "Server 2",
                    type: "server" as const,
                    parent: "group3",
                    x: 350,
                    y: -180,
                    info: "Web server - 10.2.0.10\nOS: CentOS 8\nCPU: 45%\nRAM: 8GB/16GB",
                    isMainNode: false,
                    status: "up" as const,
                    cpu: 45,
                    memory: 50,
                    temperature: 35,
                },
                {
                    id: "client3",
                    label: "Client 3",
                    type: "client" as const,
                    parent: "group3",
                    x: 250,
                    y: -180,
                    info: "Laptop - 10.2.0.101\nOS: macOS\nUser: Charlie",
                    isMainNode: false,
                    status: "up" as const,
                    cpu: 25,
                    memory: 40,
                },
            ],
            edges: [
                {
                    id: "e1",
                    source: "router1",
                    target: "router2",
                    status: "up" as const,
                    bandwidth: "1Gbps",
                    traffic: 65,
                    sourcePort: "Gi0/0/0",
                    targetPort: "Gi0/1/0",
                },
                {
                    id: "e2",
                    source: "router2",
                    target: "router3",
                    status: "warning" as const,
                    bandwidth: "1Gbps",
                    traffic: 30,
                    sourcePort: "Gi0/0/1",
                    targetPort: "Gi0/1/1",
                },
                {
                    id: "e3",
                    source: "router1",
                    target: "switch1",
                    status: "up" as const,
                    bandwidth: "1Gbps",
                    traffic: 85,
                    sourcePort: "Gi0/0/1",
                    targetPort: "Gi0/1",
                    vlan: 10,
                },
                {
                    id: "e4",
                    source: "router2",
                    target: "switch2",
                    status: "up" as const,
                    bandwidth: "1Gbps",
                    traffic: 55,
                    sourcePort: "Gi0/0/2",
                    targetPort: "Gi0/1",
                    vlan: 20,
                },
                {
                    id: "e5",
                    source: "switch1",
                    target: "server1",
                    status: "up" as const,
                    bandwidth: "100Mbps",
                    traffic: 70,
                    sourcePort: "Fa0/1",
                    targetPort: "eth0",
                    vlan: 10,
                },
                {
                    id: "e6",
                    source: "switch2",
                    target: "server2",
                    status: "up" as const,
                    bandwidth: "100Mbps",
                    traffic: 40,
                    sourcePort: "Fa0/1",
                    targetPort: "eth0",
                    vlan: 20,
                },
                {
                    id: "e7",
                    source: "switch1",
                    target: "client1",
                    status: "up" as const,
                    bandwidth: "100Mbps",
                    traffic: 25,
                    sourcePort: "Fa0/2",
                    targetPort: "eth0",
                    vlan: 10,
                },
                {
                    id: "e8",
                    source: "switch1",
                    target: "client2",
                    status: "down" as const,
                    bandwidth: "100Mbps",
                    traffic: 0,
                    sourcePort: "Fa0/3",
                    targetPort: "eth0",
                    vlan: 10,
                },
                {
                    id: "e9",
                    source: "switch2",
                    target: "client3",
                    status: "up" as const,
                    bandwidth: "100Mbps",
                    traffic: 35,
                    sourcePort: "Fa0/2",
                    targetPort: "eth0",
                    vlan: 20,
                },
            ],
        };

        // 데이터 로드 (그룹 노드 먼저, 그 다음 자식 노드들)
        const groupNodes = networkData.nodes.filter(node => node.type === "group");
        const childNodes = networkData.nodes.filter(node => node.type !== "group");
        
        // 그룹 노드들 먼저 추가
        groupNodes.forEach((node) => renderer.addNode(node));
        // 자식 노드들 추가
        childNodes.forEach((node) => renderer.addNode(node));
        // 모든 그룹 경계 업데이트
        groupNodes.forEach((group) => {
            const groupNode = renderer.nodes.get(group.id);
            if (groupNode) renderer.updateGroupBounds(groupNode);
        });
        // 엣지 추가
        networkData.edges.forEach((edge) => renderer.addEdge(edge));

        // 렌더링 시작
        renderer.render();

        // 상태 모니터링 (호버/선택/줌/축소)
        let monitorId: number;
        const monitor = () => {
            if (!renderer) return;

            try {
                const hovered = renderer.getHoveredNode();
                const selected = renderer.getSelectedNode();
                const zoom = renderer.getCurrentZoom();
                const collapsed = renderer.getIsCollapsed();
                const autoCollapse = renderer.getIsAutoCollapse();

                if (hovered !== hoveredNode) {
                    setHoveredNode(hovered);
                }

                if (selected !== selectedNode) {
                    setSelectedNode(selected);
                    if (selected?.details) {
                        setShowModal(true);
                    }
                }

                if (Math.abs(zoom - currentZoom) > 0.01) {
                    setCurrentZoom(zoom);
                }

                if (collapsed !== isCollapsed) {
                    setIsCollapsed(collapsed);
                }

                if (autoCollapse !== isAutoCollapse) {
                    setIsAutoCollapse(autoCollapse);
                }

                monitorId = requestAnimationFrame(monitor);
            } catch (error) {
                console.error("상태 모니터링 에러:", error);
            }
        };
        monitor();

        return () => {
            // 렌더링 루프 중지
            renderer.stopRendering();
            // 모니터링 루프 중지
            if (monitorId) {
                cancelAnimationFrame(monitorId);
            }
        };
    }, []);

    return (
        <div style={{ width: "100%", height: "100vh", padding: "20px", position: "relative" }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "20px",
                }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <div style={{ fontSize: "12px", color: "#666" }}>
                        줌: {Math.round(currentZoom * 100)}%
                    </div>
                    <button
                        onClick={() => {
                            const newAutoCollapse = !isAutoCollapse;
                            setIsAutoCollapse(newAutoCollapse);
                            if (rendererRef.current) {
                                rendererRef.current.setAutoCollapse(newAutoCollapse);
                            }
                        }}
                        style={{
                            padding: "6px 12px",
                            backgroundColor: isAutoCollapse ? "#27ae60" : "#95a5a6",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                        }}>
                        자동 축소: {isAutoCollapse ? "ON" : "OFF"}
                    </button>
                    <button
                        onClick={() => {
                            if (rendererRef.current) {
                                rendererRef.current.setAutoCollapse(false);
                                rendererRef.current.toggleCollapse();
                            }
                        }}
                        style={{
                            padding: "8px 16px",
                            backgroundColor: isCollapsed ? "#e74c3c" : "#3498db",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "14px",
                            opacity: isAutoCollapse ? 0.6 : 1,
                        }}
                        disabled={isAutoCollapse}>
                        {isCollapsed ? "전체 보기" : "축소 보기"}
                    </button>
                </div>
            </div>

            <canvas
                ref={canvasRef}
                style={{
                    width: "100%",
                    height: "80vh",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    backgroundColor: "#f8f9fa",
                }}
            />

            {/* 호버 툴팁 */}
            {hoveredNode && (
                <div
                    style={{
                        position: "fixed",
                        left: "50%",
                        top: "20px",
                        transform: "translateX(-50%)",
                        backgroundColor: "rgba(0, 0, 0, 0.9)",
                        color: "white",
                        padding: "8px 12px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        zIndex: 1000,
                        pointerEvents: "none",
                    }}>
                    {hoveredNode.info}
                </div>
            )}

            {/* 범례 */}
            <div
                style={{
                    position: "absolute",
                    top: "80px",
                    right: "30px",
                    backgroundColor: "white",
                    padding: "15px",
                    borderRadius: "8px",
                    border: "1px solid #ddd",
                    fontSize: "12px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>순수 JS 버전</h4>
                <div style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}>
                    <div
                        style={{
                            width: "16px",
                            height: "16px",
                            backgroundColor: "#e74c3c",
                            marginRight: "8px",
                            borderRadius: "2px",
                        }}></div>
                    라우터
                </div>
                <div style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}>
                    <div
                        style={{
                            width: "16px",
                            height: "16px",
                            backgroundColor: "#3498db",
                            marginRight: "8px",
                        }}></div>
                    스위치
                </div>
                <div style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}>
                    <div
                        style={{
                            width: "16px",
                            height: "16px",
                            backgroundColor: "#2ecc71",
                            marginRight: "8px",
                            borderRadius: "2px",
                        }}></div>
                    서버
                </div>
                <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
                    <div
                        style={{
                            width: "16px",
                            height: "16px",
                            backgroundColor: "#f39c12",
                            marginRight: "8px",
                            borderRadius: "50%",
                        }}></div>
                    클라이언트
                </div>

                <h4
                    style={{
                        margin: "15px 0 8px 0",
                        fontSize: "14px",
                        borderTop: "1px solid #eee",
                        paddingTop: "8px",
                    }}>
                    VLAN 구분
                </h4>
                <div style={{ display: "flex", alignItems: "center", marginBottom: "3px" }}>
                    <div
                        style={{
                            width: "16px",
                            height: "8px",
                            backgroundColor: "#2980b9",
                            marginRight: "8px",
                        }}></div>
                    <span style={{ fontSize: "11px" }}>VLAN 10 (관리)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", marginBottom: "3px" }}>
                    <div
                        style={{
                            width: "16px",
                            height: "8px",
                            backgroundColor: "#27ae60",
                            marginRight: "8px",
                        }}></div>
                    <span style={{ fontSize: "11px" }}>VLAN 20 (데이터)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}>
                    <div
                        style={{
                            width: "16px",
                            height: "8px",
                            backgroundColor: "#8e44ad",
                            marginRight: "8px",
                        }}></div>
                    <span style={{ fontSize: "11px" }}>VLAN 1 (기본)</span>
                </div>

                <div
                    style={{
                        fontSize: "11px",
                        color: "#666",
                        borderTop: "1px solid #eee",
                        paddingTop: "8px",
                    }}>
                    <strong>네트워크 상태:</strong>
                    <br />
                    • 🟢 UP / 🔴 DOWN / 🟡 WARNING
                    <br />
                    • CPU/메모리 상태 바<br />
                    • 트래픽 실시간 모니터링
                    <br />
                    • 포트별 연결 상태
                    <br />
                    <br />
                    <strong>고급 기능:</strong>
                    <br />
                    • 직각 그리드 연결선
                    <br />
                    • 경로 하이라이트 (노드 선택)
                    <br />
                    • 줌 &lt; 70%: 자동 축소
                    <br />
                    • VLAN 색상 구분
                    <br />
                    • 실시간 메트릭
                    <br />
                    <br />
                    <strong>조작법:</strong>
                    <br />
                    • 노드 드래그: 그룹 내에서만 이동
                    <br />
                    • 그룹 드래그: 그룹 전체 이동
                    <br />
                    • Alt+노드 드래그: 그룹 전체 이동
                    <br />
                    • Ctrl+클릭: 노드 포커스
                    <br />
                    • 그룹 헤더 클릭: 접기/펼치기
                    <br />• 마우스 휠: 줌 및 자동 축소
                </div>
            </div>
        </div>
    );
}

export default VanillaPage;
