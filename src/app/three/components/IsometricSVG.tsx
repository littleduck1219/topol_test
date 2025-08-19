"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";

// 노드 데이터 타입 정의
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

// 엣지 데이터 타입 정의
interface EdgeData {
    id: string;
    source: string;
    target: string;
}

// 등축 투영법 (Isometric Projection) 구현
class IsometricProjection {
    // 표준 등축 투영 각도 (30도 회전)
    private static readonly COS_30 = Math.cos(Math.PI / 6); // cos(30°) ≈ 0.866
    private static readonly SIN_30 = Math.sin(Math.PI / 6); // sin(30°) = 0.5

    static project(x: number, y: number, z: number): { x: number; y: number } {
        // 표준 등축 투영 공식
        const projectedX = (x - z) * this.COS_30;
        const projectedY = (x + z) * this.SIN_30 - y;
        return { x: projectedX, y: projectedY };
    }

    static unproject(screenX: number, screenY: number, y: number = 0): { x: number; z: number } {
        // 등축 투영의 역변환
        const adjustedY = screenY + y;
        const x = (screenX / this.COS_30 + adjustedY / this.SIN_30) / 2;
        const z = (adjustedY / this.SIN_30 - screenX / this.COS_30) / 2;
        return { x, z };
    }
}

// SVG 기반 Isometric 렌더러 (yFiles 스타일)
interface IsometricSVGProps {
    nodes: NodeData[];
    edges: EdgeData[];
    selectedNode: string | null;
    onNodeSelect: (id: string) => void;
    onNodeHeightChange: (id: string, height: number) => void;
    onNodePositionChange?: (id: string, x: number, z: number) => void;
    showGrid: boolean;
    rotation: number;
    width: number;
    height: number;
}

export default function IsometricSVG({
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
}: IsometricSVGProps) {
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

    // SVG 그리드 생성
    const renderGrid = useCallback(() => {
        if (!showGrid) return null;

        const gridLines = [];
        const gridSize = 15;
        const cellSize = 60;

        // X방향 선들
        for (let i = -gridSize; i <= gridSize; i++) {
            for (let j = -gridSize; j <= gridSize; j++) {
                const x = i * cellSize;
                const z = j * cellSize;

                if (j < gridSize) {
                    const start = transformPoint(x, 0, z);
                    const end = transformPoint(x, 0, z + cellSize);

                    gridLines.push(
                        <line
                            key={`grid-x-${i}-${j}`}
                            x1={start.x}
                            y1={start.y}
                            x2={end.x}
                            y2={end.y}
                            stroke='#d0d0d0'
                            strokeWidth='0.8'
                        />
                    );
                }

                if (i < gridSize) {
                    const start = transformPoint(x, 0, z);
                    const end = transformPoint(x + cellSize, 0, z);

                    gridLines.push(
                        <line
                            key={`grid-z-${i}-${j}`}
                            x1={start.x}
                            y1={start.y}
                            x2={end.x}
                            y2={end.y}
                            stroke='#d0d0d0'
                            strokeWidth='0.8'
                        />
                    );
                }
            }
        }

        // 메인 축 강조
        const xStart = transformPoint(-gridSize * cellSize, 0, 0);
        const xEnd = transformPoint(gridSize * cellSize, 0, 0);
        const zStart = transformPoint(0, 0, -gridSize * cellSize);
        const zEnd = transformPoint(0, 0, gridSize * cellSize);

        gridLines.push(
            <line
                key='main-x-axis'
                x1={xStart.x}
                y1={xStart.y}
                x2={xEnd.x}
                y2={xEnd.y}
                stroke='#a0a0a0'
                strokeWidth='1.5'
            />,
            <line
                key='main-z-axis'
                x1={zStart.x}
                y1={zStart.y}
                x2={zEnd.x}
                y2={zEnd.y}
                stroke='#a0a0a0'
                strokeWidth='1.5'
            />
        );

        return <g className='grid'>{gridLines}</g>;
    }, [showGrid, transformPoint]);

    // SVG 노드 생성
    const renderNode = useCallback(
        (node: NodeData) => {
            const w = node.width || 50;
            const d = node.depth || 50;
            const h = node.height * 50;

            // 노드의 8개 꼭짓점 계산
            const corners = [
                // 하단면
                { x: node.x - w / 2, y: 0, z: node.z - d / 2 }, // 0: 좌후하
                { x: node.x + w / 2, y: 0, z: node.z - d / 2 }, // 1: 우후하
                { x: node.x + w / 2, y: 0, z: node.z + d / 2 }, // 2: 우전하
                { x: node.x - w / 2, y: 0, z: node.z + d / 2 }, // 3: 좌전하
                // 상단면
                { x: node.x - w / 2, y: h, z: node.z - d / 2 }, // 4: 좌후상
                { x: node.x + w / 2, y: h, z: node.z - d / 2 }, // 5: 우후상
                { x: node.x + w / 2, y: h, z: node.z + d / 2 }, // 6: 우전상
                { x: node.x - w / 2, y: h, z: node.z + d / 2 }, // 7: 좌전상
            ];

            const projectedCorners = corners.map((corner) =>
                transformPoint(corner.x, corner.y, corner.z)
            );

            const isSelected = selectedNode === node.id;
            const baseColor = isSelected ? "#ffffff" : node.color;

            // 색상 유틸리티 함수
            const lightenColor = (color: string, amount: number): string => {
                const hex = color.replace("#", "");
                const r = parseInt(hex.substr(0, 2), 16);
                const g = parseInt(hex.substr(2, 2), 16);
                const b = parseInt(hex.substr(4, 2), 16);

                const newR = Math.min(255, Math.floor(r + (255 - r) * amount));
                const newG = Math.min(255, Math.floor(g + (255 - g) * amount));
                const newB = Math.min(255, Math.floor(b + (255 - b) * amount));

                return `rgb(${newR}, ${newG}, ${newB})`;
            };

            const darkenColor = (color: string, amount: number): string => {
                const hex = color.replace("#", "");
                const r = parseInt(hex.substr(0, 2), 16);
                const g = parseInt(hex.substr(2, 2), 16);
                const b = parseInt(hex.substr(4, 2), 16);

                const newR = Math.max(0, Math.floor(r * (1 - amount)));
                const newG = Math.max(0, Math.floor(g * (1 - amount)));
                const newB = Math.max(0, Math.floor(b * (1 - amount)));

                return `rgb(${newR}, ${newG}, ${newB})`;
            };

            const faces = [];

            // 1. 바닥면
            if (h > 10) {
                faces.push(
                    <polygon
                        key={`${node.id}-bottom`}
                        points={`${projectedCorners[0].x},${projectedCorners[0].y} ${projectedCorners[1].x},${projectedCorners[1].y} ${projectedCorners[2].x},${projectedCorners[2].y} ${projectedCorners[3].x},${projectedCorners[3].y}`}
                        fill={darkenColor(baseColor, 0.5)}
                        stroke='#2c3e50'
                        strokeWidth='0'
                    />
                );
            }

            // 2. 후면
            faces.push(
                <polygon
                    key={`${node.id}-back`}
                    points={`${projectedCorners[0].x},${projectedCorners[0].y} ${projectedCorners[1].x},${projectedCorners[1].y} ${projectedCorners[5].x},${projectedCorners[5].y} ${projectedCorners[4].x},${projectedCorners[4].y}`}
                    fill={darkenColor(baseColor, 0.4)}
                    stroke='#2c3e50'
                    strokeWidth='0'
                />
            );

            // 3. 좌측면
            faces.push(
                <polygon
                    key={`${node.id}-left`}
                    points={`${projectedCorners[0].x},${projectedCorners[0].y} ${projectedCorners[3].x},${projectedCorners[3].y} ${projectedCorners[7].x},${projectedCorners[7].y} ${projectedCorners[4].x},${projectedCorners[4].y}`}
                    fill={darkenColor(baseColor, 0.35)}
                    stroke='#2c3e50'
                    strokeWidth='0'
                />
            );

            // 4. 정면
            faces.push(
                <polygon
                    key={`${node.id}-front`}
                    points={`${projectedCorners[3].x},${projectedCorners[3].y} ${projectedCorners[2].x},${projectedCorners[2].y} ${projectedCorners[6].x},${projectedCorners[6].y} ${projectedCorners[7].x},${projectedCorners[7].y}`}
                    fill={baseColor}
                    stroke='#2c3e50'
                    strokeWidth='0'
                />
            );

            // 5. 우측면
            faces.push(
                <polygon
                    key={`${node.id}-right`}
                    points={`${projectedCorners[2].x},${projectedCorners[2].y} ${projectedCorners[1].x},${projectedCorners[1].y} ${projectedCorners[5].x},${projectedCorners[5].y} ${projectedCorners[6].x},${projectedCorners[6].y}`}
                    fill={darkenColor(baseColor, 0.25)}
                    stroke='#2c3e50'
                    strokeWidth='0'
                />
            );

            // 6. 상단면
            faces.push(
                <polygon
                    key={`${node.id}-top`}
                    points={`${projectedCorners[7].x},${projectedCorners[7].y} ${projectedCorners[6].x},${projectedCorners[6].y} ${projectedCorners[5].x},${projectedCorners[5].y} ${projectedCorners[4].x},${projectedCorners[4].y}`}
                    fill={lightenColor(baseColor, 0.3)}
                    stroke='#2c3e50'
                    strokeWidth='0'
                />
            );

            // 노드 라벨
            const labelPos = transformPoint(node.x, h + 25, node.z);
            faces.push(
                <text
                    key={`${node.id}-label`}
                    x={labelPos.x}
                    y={labelPos.y}
                    fill='#2c3e50'
                    fontSize='13'
                    fontWeight='bold'
                    textAnchor='middle'
                    fontFamily='Arial, sans-serif'>
                    {node.label}
                </text>
            );

            // 선택된 노드 표시
            if (isSelected) {
                const handlePos = transformPoint(node.x, h + 35, node.z);
                faces.push(
                    <rect
                        key={`${node.id}-handle`}
                        x={handlePos.x - 8}
                        y={handlePos.y - 8}
                        width='16'
                        height='16'
                        fill='#e74c3c'
                    />
                );
            }

            return <g key={`node-${node.id}`}>{faces}</g>;
        },
        [selectedNode, transformPoint]
    );

    // SVG 엣지 생성
    const renderEdge = useCallback(
        (edge: EdgeData) => {
            const sourceNode = nodes.find((n) => n.id === edge.source);
            const targetNode = nodes.find((n) => n.id === edge.target);

            if (!sourceNode || !targetNode) return null;

            // 노드의 바닥 중심에서 연결
            const sourcePos = transformPoint(sourceNode.x, 0, sourceNode.z);
            const targetPos = transformPoint(targetNode.x, 0, targetNode.z);

            return (
                <g key={`edge-${edge.id}`}>
                    {/* 그림자 */}
                    <line
                        x1={sourcePos.x + 1}
                        y1={sourcePos.y + 1}
                        x2={targetPos.x + 1}
                        y2={targetPos.y + 1}
                        stroke='#bdc3c7'
                        strokeWidth='4'
                    />
                    {/* 메인 엣지 */}
                    <line
                        x1={sourcePos.x}
                        y1={sourcePos.y}
                        x2={targetPos.x}
                        y2={targetPos.y}
                        stroke='#34495e'
                        strokeWidth='2.5'
                    />
                </g>
            );
        },
        [nodes, transformPoint]
    );

    // 마우스 이벤트 핸들러
    const handleMouseDown = useCallback(
        (event: React.MouseEvent<SVGSVGElement>) => {
            const rect = svgRef.current?.getBoundingClientRect();
            if (!rect) return;

            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            // 노드 클릭 감지
            for (const node of nodes) {
                const nodePos = transformPoint(node.x, node.height * 25, node.z);
                const distance = Math.sqrt((mouseX - nodePos.x) ** 2 + (mouseY - nodePos.y) ** 2);

                if (distance < 40) {
                    setDragNodeId(node.id);
                    setDragStart({ x: mouseX, y: mouseY });
                    setIsDragging(true);

                    if (event.shiftKey) {
                        setDragMode("height");
                    } else {
                        onNodeSelect(node.id);
                        setDragMode("position");
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
        (event: React.MouseEvent<SVGSVGElement>) => {
            if (!isDragging) return;

            const rect = svgRef.current?.getBoundingClientRect();
            if (!rect) return;

            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            if (dragNodeId) {
                const node = nodes.find((n) => n.id === dragNodeId);
                if (!node) return;

                if (dragMode === "height") {
                    const deltaY = dragStart.y - mouseY;
                    const heightChange = deltaY * 0.02;
                    const newHeight = Math.max(0.1, node.height + heightChange);
                    onNodeHeightChange(dragNodeId, newHeight);
                    setDragStart({ x: mouseX, y: mouseY });
                } else if (dragMode === "position" && onNodePositionChange) {
                    const deltaX = mouseX - dragStart.x;
                    const deltaY = mouseY - dragStart.y;

                    const screenDelta = IsometricProjection.unproject(
                        deltaX / camera.zoom,
                        deltaY / camera.zoom
                    );

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
        setDragMode("camera");
    }, []);

    const handleWheel = useCallback((event: React.WheelEvent<SVGSVGElement>) => {
        event.preventDefault();
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        setCamera((prev) => ({
            ...prev,
            zoom: Math.max(0.1, Math.min(3, prev.zoom * zoomFactor)),
        }));
    }, []);

    // Z-depth로 노드 정렬
    const sortedNodes = [...nodes].sort((a, b) => {
        const depthA = a.x + a.z;
        const depthB = b.x + b.z;
        return depthA - depthB;
    });

    const sortedEdges = [...edges].sort((a, b) => {
        const nodeA1 = nodes.find((n) => n.id === a.source);
        const nodeA2 = nodes.find((n) => n.id === a.target);
        const nodeB1 = nodes.find((n) => n.id === b.source);
        const nodeB2 = nodes.find((n) => n.id === b.target);

        if (!nodeA1 || !nodeA2 || !nodeB1 || !nodeB2) return 0;

        const depthA = Math.min(nodeA1.x + nodeA1.z, nodeA2.x + nodeA2.z);
        const depthB = Math.min(nodeB1.x + nodeB1.z, nodeB2.x + nodeB2.z);
        return depthA - depthB;
    });

    return (
        <div className='relative w-full h-full bg-white'>
            <svg
                ref={svgRef}
                width={width}
                height={height}
                className='cursor-grab active:cursor-grabbing'
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}>
                {/* 그리드 */}
                {renderGrid()}

                {/* 엣지 (노드보다 먼저) */}
                {sortedEdges.map((edge) => renderEdge(edge))}

                {/* 노드 (Z-order 정렬) */}
                {sortedNodes.map((node) => renderNode(node))}
            </svg>
        </div>
    );
}
