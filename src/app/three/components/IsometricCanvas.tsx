"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";

// 노드 데이터 타입
interface NodeData {
    id: string;
    x: number;
    z: number;
    height: number;
    color: string;
    label: string;
    width?: number;
    depth?: number;
}

// 엣지 데이터 타입
interface EdgeData {
    id: string;
    source: string;
    target: string;
}

// 등축 투영법 (Isometric Projection) 구현
class IsometricProjection {
    // 등축 투영에서 사용되는 표준 각도
    private static readonly ANGLE_X = Math.atan(Math.sin(Math.PI / 6)); // ≈ 30도의 정확한 등축 각도
    private static readonly ANGLE_Y = Math.PI / 4; // 45도
    private static readonly SCALE_X = Math.cos(this.ANGLE_Y);
    private static readonly SCALE_Y = Math.sin(this.ANGLE_Y);

    static project(x: number, y: number, z: number): { x: number; y: number } {
        // 정확한 등축 투영 공식
        const projectedX = (x - z) * this.SCALE_X;
        const projectedY = (x + z) * this.SCALE_Y * 0.5 - y;
        return { x: projectedX, y: projectedY };
    }

    static projectPoint(point: { x: number; y: number; z: number }): { x: number; y: number } {
        return this.project(point.x, point.y, point.z);
    }

    // 화면 좌표를 월드 좌표로 역변환 (근사치)
    static unproject(screenX: number, screenY: number, y: number = 0): { x: number; z: number } {
        // 등축 투영의 역변환 (Y축은 고정)
        const x = (screenX / this.SCALE_X + (screenY + y) / (this.SCALE_Y * 0.5)) * 0.5;
        const z = ((screenY + y) / (this.SCALE_Y * 0.5) - screenX / this.SCALE_X) * 0.5;
        return { x, z };
    }
}

// Canvas 기반 Isometric 렌더러
interface IsometricCanvasProps {
    nodes: NodeData[];
    edges: EdgeData[];
    selectedNode: string | null;
    onNodeSelect: (id: string) => void;
    onNodeHeightChange: (id: string, height: number) => void;
    showGrid: boolean;
    rotation: number;
    width: number;
    height: number;
}

// 노드 위치 변경을 위한 prop 추가
interface IsometricCanvasProps {
    nodes: NodeData[];
    edges: EdgeData[];
    selectedNode: string | null;
    onNodeSelect: (id: string) => void;
    onNodeHeightChange: (id: string, height: number) => void;
    onNodePositionChange?: (id: string, x: number, z: number) => void; // 새로 추가
    showGrid: boolean;
    rotation: number;
    width: number;
    height: number;
}

export default function IsometricCanvas({
    nodes,
    edges,
    selectedNode,
    onNodeSelect,
    onNodeHeightChange,
    onNodePositionChange,
    showGrid,
    rotation,
    width,
    height,
}: IsometricCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [dragNodeId, setDragNodeId] = useState<string | null>(null);
    const [dragMode, setDragMode] = useState<"camera" | "height" | "position">("camera");
    const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });

    // 좌표 변환 함수
    const transformPoint = useCallback(
        (x: number, y: number, z: number) => {
            // 회전 적용
            const rotRad = (rotation * Math.PI) / 180;
            const rotatedX = x * Math.cos(rotRad) - z * Math.sin(rotRad);
            const rotatedZ = x * Math.sin(rotRad) + z * Math.cos(rotRad);

            // Isometric 투영
            const projected = IsometricProjection.project(rotatedX, y, rotatedZ);

            // 카메라 변환 및 화면 중앙 배치
            return {
                x: projected.x * camera.zoom + width / 2 + camera.x,
                y: projected.y * camera.zoom + height / 2 + camera.y,
            };
        },
        [rotation, camera, width, height]
    );

    // 그리드 그리기
    const drawGrid = useCallback(
        (ctx: CanvasRenderingContext2D) => {
            if (!showGrid) return;

            ctx.strokeStyle = "#e0e0e0";
            ctx.lineWidth = 1;

            const gridSize = 20;
            const cellSize = 50;

            for (let i = -gridSize; i <= gridSize; i++) {
                for (let j = -gridSize; j <= gridSize; j++) {
                    const x = i * cellSize;
                    const z = j * cellSize;

                    // 가로선
                    const start1 = transformPoint(x, 0, z);
                    const end1 = transformPoint(x + cellSize, 0, z);

                    // 세로선
                    const start2 = transformPoint(x, 0, z);
                    const end2 = transformPoint(x, 0, z + cellSize);

                    ctx.beginPath();
                    ctx.moveTo(start1.x, start1.y);
                    ctx.lineTo(end1.x, end1.y);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(start2.x, start2.y);
                    ctx.lineTo(end2.x, end2.y);
                    ctx.stroke();
                }
            }
        },
        [showGrid, transformPoint]
    );

    // 노드 그리기
    const drawNode = useCallback(
        (ctx: CanvasRenderingContext2D, node: NodeData) => {
            const w = node.width || 60;
            const d = node.depth || 60;
            const h = node.height * 40;

            // 노드의 8개 꼭짓점 계산
            const corners = [
                { x: node.x - w / 2, y: 0, z: node.z - d / 2 },
                { x: node.x + w / 2, y: 0, z: node.z - d / 2 },
                { x: node.x + w / 2, y: 0, z: node.z + d / 2 },
                { x: node.x - w / 2, y: 0, z: node.z + d / 2 },
                { x: node.x - w / 2, y: h, z: node.z - d / 2 },
                { x: node.x + w / 2, y: h, z: node.z - d / 2 },
                { x: node.x + w / 2, y: h, z: node.z + d / 2 },
                { x: node.x - w / 2, y: h, z: node.z + d / 2 },
            ];

            const projectedCorners = corners.map((corner) =>
                transformPoint(corner.x, corner.y, corner.z)
            );

            // 면들 그리기 (isometric 순서대로)
            const isSelected = selectedNode === node.id;
            const baseColor = isSelected ? "#ffffff" : node.color;

            // 상단면
            ctx.fillStyle = lightenColor(baseColor, 0.3);
            ctx.beginPath();
            ctx.moveTo(projectedCorners[4].x, projectedCorners[4].y);
            ctx.lineTo(projectedCorners[5].x, projectedCorners[5].y);
            ctx.lineTo(projectedCorners[6].x, projectedCorners[6].y);
            ctx.lineTo(projectedCorners[7].x, projectedCorners[7].y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = darkenColor(baseColor, 0.3);
            ctx.stroke();

            // 좌측면
            ctx.fillStyle = darkenColor(baseColor, 0.2);
            ctx.beginPath();
            ctx.moveTo(projectedCorners[0].x, projectedCorners[0].y);
            ctx.lineTo(projectedCorners[3].x, projectedCorners[3].y);
            ctx.lineTo(projectedCorners[7].x, projectedCorners[7].y);
            ctx.lineTo(projectedCorners[4].x, projectedCorners[4].y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 우측면
            ctx.fillStyle = baseColor;
            ctx.beginPath();
            ctx.moveTo(projectedCorners[1].x, projectedCorners[1].y);
            ctx.lineTo(projectedCorners[2].x, projectedCorners[2].y);
            ctx.lineTo(projectedCorners[6].x, projectedCorners[6].y);
            ctx.lineTo(projectedCorners[5].x, projectedCorners[5].y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 노드 라벨
            const labelPos = transformPoint(node.x, h + 20, node.z);
            ctx.fillStyle = "#333333";
            ctx.font = "12px Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(node.label, labelPos.x, labelPos.y);

            // 선택된 노드의 높이 조절 핸들
            if (isSelected) {
                const handlePos = transformPoint(node.x, h + 30, node.z);
                ctx.fillStyle = "#ff6b6b";
                ctx.fillRect(handlePos.x - 5, handlePos.y - 5, 10, 10);
            }
        },
        [selectedNode, transformPoint]
    );

    // 엣지 그리기
    const drawEdge = useCallback(
        (ctx: CanvasRenderingContext2D, edge: EdgeData) => {
            const sourceNode = nodes.find((n) => n.id === edge.source);
            const targetNode = nodes.find((n) => n.id === edge.target);

            if (!sourceNode || !targetNode) return;

            const sourcePos = transformPoint(sourceNode.x, sourceNode.height * 20, sourceNode.z);
            const targetPos = transformPoint(targetNode.x, targetNode.height * 20, targetNode.z);

            ctx.strokeStyle = "#666666";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sourcePos.x, sourcePos.y);
            ctx.lineTo(targetPos.x, targetPos.y);
            ctx.stroke();
        },
        [nodes, transformPoint]
    );

    // 마우스 이벤트 처리
    const handleMouseDown = useCallback(
        (event: React.MouseEvent<HTMLCanvasElement>) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;

            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            // 노드 클릭 감지
            for (const node of nodes) {
                const nodePos = transformPoint(node.x, node.height * 20, node.z);
                const distance = Math.sqrt((mouseX - nodePos.x) ** 2 + (mouseY - nodePos.y) ** 2);

                if (distance < 40) {
                    setDragNodeId(node.id);
                    setDragStart({ x: mouseX, y: mouseY });
                    setIsDragging(true);

                    if (event.shiftKey) {
                        // Shift + 클릭: 높이 조절 모드
                        setDragMode("height");
                    } else if (event.ctrlKey || event.metaKey) {
                        // Ctrl/Cmd + 클릭: 위치 이동 모드
                        setDragMode("position");
                    } else {
                        // 일반 클릭: 선택
                        onNodeSelect(node.id);
                        setDragMode("position"); // 선택된 노드는 바로 이동 가능
                    }
                    return;
                }
            }

            // 빈 공간 클릭 - 카메라 팬
            setIsDragging(true);
            setDragMode("camera");
            setDragStart({ x: mouseX, y: mouseY });
        },
        [nodes, transformPoint, onNodeSelect]
    );

    const handleMouseMove = useCallback(
        (event: React.MouseEvent<HTMLCanvasElement>) => {
            if (!isDragging) return;

            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;

            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            if (dragNodeId) {
                const node = nodes.find((n) => n.id === dragNodeId);
                if (!node) return;

                if (dragMode === "height") {
                    // 높이 조절
                    const deltaY = dragStart.y - mouseY;
                    const heightChange = deltaY * 0.02;
                    const newHeight = Math.max(0.1, node.height + heightChange);
                    onNodeHeightChange(dragNodeId, newHeight);
                    setDragStart({ x: mouseX, y: mouseY });
                } else if (dragMode === "position" && onNodePositionChange) {
                    // 위치 이동 - 화면 좌표를 등축 투영 좌표로 변환
                    const deltaX = mouseX - dragStart.x;
                    const deltaY = mouseY - dragStart.y;

                    // 등축 투영 역변환을 통해 실제 3D 공간의 X, Z 좌표 계산
                    const screenDelta = IsometricProjection.unproject(
                        deltaX / camera.zoom,
                        deltaY / camera.zoom
                    );

                    // 회전 적용 (역회전)
                    const rotRad = -(rotation * Math.PI) / 180;
                    const rotatedDeltaX =
                        screenDelta.x * Math.cos(rotRad) - screenDelta.z * Math.sin(rotRad);
                    const rotatedDeltaZ =
                        screenDelta.x * Math.sin(rotRad) + screenDelta.z * Math.cos(rotRad);

                    const newX = node.x + rotatedDeltaX;
                    const newZ = node.z + rotatedDeltaZ;

                    onNodePositionChange(dragNodeId, newX, newZ);
                    setDragStart({ x: mouseX, y: mouseY });
                }
            } else if (dragMode === "camera") {
                // 카메라 팬
                const deltaX = mouseX - dragStart.x;
                const deltaY = mouseY - dragStart.y;
                setCamera((prev) => ({
                    ...prev,
                    x: prev.x + deltaX,
                    y: prev.y + deltaY,
                }));
                setDragStart({ x: mouseX, y: mouseY });
            }
        },
        [
            isDragging,
            dragNodeId,
            dragMode,
            dragStart,
            nodes,
            onNodeHeightChange,
            onNodePositionChange,
            camera.zoom,
            rotation,
        ]
    );

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setDragNodeId(null);
    }, []);

    // 휠 이벤트 (줌)
    const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
        event.preventDefault();
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        setCamera((prev) => ({
            ...prev,
            zoom: Math.max(0.1, Math.min(3, prev.zoom * zoomFactor)),
        }));
    }, []);

    // 렌더링
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // 캔버스 클리어
        ctx.clearRect(0, 0, width, height);

        // 그리드 그리기
        drawGrid(ctx);

        // 엣지 그리기 (노드보다 먼저)
        edges.forEach((edge) => drawEdge(ctx, edge));

        // 노드 그리기 (Z 순서로 정렬)
        const sortedNodes = [...nodes].sort((a, b) => a.x + a.z - (b.x + b.z));
        sortedNodes.forEach((node) => drawNode(ctx, node));
    }, [nodes, edges, drawGrid, drawEdge, drawNode, width, height]);

    return (
        <div className='relative'>
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className='cursor-grab active:cursor-grabbing'
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            />
            <svg
                ref={svgRef}
                width={width}
                height={height}
                className='absolute top-0 left-0 pointer-events-none'>
                {/* SVG 오버레이는 필요시 추가 */}
            </svg>
        </div>
    );
}

// 색상 유틸리티 함수
function lightenColor(color: string, amount: number): string {
    const num = parseInt(color.replace("#", ""), 16);
    const r = Math.min(255, Math.floor((num >> 16) + 255 * amount));
    const g = Math.min(255, Math.floor(((num >> 8) & 0x00ff) + 255 * amount));
    const b = Math.min(255, Math.floor((num & 0x0000ff) + 255 * amount));
    return `rgb(${r}, ${g}, ${b})`;
}

function darkenColor(color: string, amount: number): string {
    const num = parseInt(color.replace("#", ""), 16);
    const r = Math.max(0, Math.floor((num >> 16) * (1 - amount)));
    const g = Math.max(0, Math.floor(((num >> 8) & 0x00ff) * (1 - amount)));
    const b = Math.max(0, Math.floor((num & 0x0000ff) * (1 - amount)));
    return `rgb(${r}, ${g}, ${b})`;
}
