"use client";

import React, { useRef, useState, useCallback } from "react";

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
    private static readonly COS_30 = Math.cos(Math.PI / 6);
    private static readonly SIN_30 = Math.sin(Math.PI / 6);

    static project(x: number, y: number, z: number): { x: number; y: number } {
        const projectedX = (x - z) * this.COS_30;
        const projectedY = (x + z) * this.SIN_30 - y;
        return { x: projectedX, y: projectedY };
    }

    static unproject(screenX: number, screenY: number, y: number = 0): { x: number; z: number } {
        const adjustedY = screenY + y;
        const x = (screenX / this.COS_30 + adjustedY / this.SIN_30) / 2;
        const z = (adjustedY / this.SIN_30 - screenX / this.COS_30) / 2;
        return { x, z };
    }
}

// 완전 SVG 기반 렌더러 (yFiles 스타일)
interface IsometricSVGPureProps {
    nodes: NodeData[];
    edges: EdgeData[];
    selectedNode: string | null;
    onNodeSelect: (id: string) => void;
    onNodeHeightChange: (id: string, height: number) => void;
    onNodePositionChange?: (id: string, x: number, z: number) => void;
    onNodeAdd?: (x: number, z: number) => void;
    onNodeDelete?: (id: string) => void;
    showGrid: boolean;
    rotation: number;
    width: number;
    height: number;
}

export default function IsometricSVGPure({
    nodes,
    edges,
    selectedNode,
    onNodeSelect,
    onNodeHeightChange,
    onNodePositionChange,
    onNodeAdd,
    onNodeDelete,
    showGrid,
    rotation,
    width,
    height,
}: IsometricSVGPureProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [dragNodeId, setDragNodeId] = useState<string | null>(null);
    const [dragMode, setDragMode] = useState<"camera" | "height" | "position">("camera");
    const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 0.5 });
    const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, nodeId: string } | null>(null);

    // 좌표 변환 함수
    const transformPoint = useCallback(
        (x: number, y: number, z: number) => {
            const rotRad = (rotation * Math.PI) / 180;
            const rotatedX = x * Math.cos(rotRad) - z * Math.sin(rotRad);
            const rotatedZ = x * Math.sin(rotRad) + z * Math.cos(rotRad);
            const projected = IsometricProjection.project(rotatedX, y, rotatedZ);
            return {
                x: projected.x * camera.zoom + width / 2 + camera.x,
                y: projected.y * camera.zoom + height / 2 + camera.y,
            };
        },
        [rotation, camera, width, height]
    );

    // 색상 유틸리티 함수
    const lightenColor = useCallback((color: string, amount: number): string => {
        const hex = color.replace("#", "");
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        const newR = Math.min(255, Math.floor(r + (255 - r) * amount));
        const newG = Math.min(255, Math.floor(g + (255 - g) * amount));
        const newB = Math.min(255, Math.floor(b + (255 - b) * amount));

        return `rgb(${newR}, ${newG}, ${newB})`;
    }, []);

    const darkenColor = useCallback((color: string, amount: number): string => {
        const hex = color.replace("#", "");
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        const newR = Math.max(0, Math.floor(r * (1 - amount)));
        const newG = Math.max(0, Math.floor(g * (1 - amount)));
        const newB = Math.max(0, Math.floor(b * (1 - amount)));

        return `rgb(${newR}, ${newG}, ${newB})`;
    }, []);

    // SVG 그리드 생성 (yFiles 스타일)
    const renderGrid = useCallback(() => {
        if (!showGrid) return null;

        const gridLines = [];
        const gridSize = 15;
        const cellSize = 60;

        // 그리드 라인들
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
                            stroke='url(#gridGradient)'
                            strokeWidth='0.5'
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
                            stroke='url(#gridGradient)'
                            strokeWidth='0.5'
                        />
                    );
                }
            }
        }

        return <g className='grid-group'>{gridLines}</g>;
    }, [showGrid, transformPoint]);

    // SVG 노드 생성 (회전별 면 가시성 처리)
    const renderNode = useCallback(
        (node: NodeData) => {
            const w = node.width || 50;
            const d = node.depth || 50;
            const h = node.height * 50;

            const isSelected = selectedNode === node.id;
            const isHovered = hoveredNode?.id === node.id;
            const baseColor = isSelected ? "#ff0000" : node.color; // 디버깅을 위해 선택된 노드는 빨간색

            // 노드의 8개 꼭짓점을 transformPoint로 정확히 계산
            const corners = [
                // 하단면 (Y=0)
                transformPoint(node.x - w / 2, 0, node.z - d / 2), // 0: 좌후하
                transformPoint(node.x + w / 2, 0, node.z - d / 2), // 1: 우후하
                transformPoint(node.x + w / 2, 0, node.z + d / 2), // 2: 우전하
                transformPoint(node.x - w / 2, 0, node.z + d / 2), // 3: 좌전하
                // 상단면 (Y=h)
                transformPoint(node.x - w / 2, h, node.z - d / 2), // 4: 좌후상
                transformPoint(node.x + w / 2, h, node.z - d / 2), // 5: 우후상
                transformPoint(node.x + w / 2, h, node.z + d / 2), // 6: 우전상
                transformPoint(node.x - w / 2, h, node.z + d / 2), // 7: 좌전상
            ];

            // 회전 각도에 따른 면 가시성 결정
            const normalizedRotation = ((rotation % 360) + 360) % 360;
            
            const faces = [];
            const visibleFaces = [];

            // 부드러운 각도 전환을 위한 면 선택 (45도 오프셋 적용)
            const angle = normalizedRotation;
            
            // 항상 상단면은 보임
            visibleFaces.push({
                name: 'top',
                points: [corners[7], corners[6], corners[5], corners[4]],
                color: lightenColor(baseColor, 0.3),
                zDepth: 1000
            });

            // 45도 오프셋으로 부드러운 전환
            const offsetAngle = (angle + 45) % 360;
            
            if (offsetAngle >= 0 && offsetAngle < 90) {
                // 315-45도: 정면 + 우측면 (기본 등축 뷰)
                visibleFaces.push(
                    {
                        name: 'front',
                        points: [corners[3], corners[2], corners[6], corners[7]],
                        color: baseColor,
                        zDepth: 500
                    },
                    {
                        name: 'right',
                        points: [corners[2], corners[1], corners[5], corners[6]],
                        color: darkenColor(baseColor, 0.2),
                        zDepth: 400
                    }
                );
            } else if (offsetAngle >= 90 && offsetAngle < 180) {
                // 45-135도: 우측면 + 후면
                visibleFaces.push(
                    {
                        name: 'right',
                        points: [corners[2], corners[1], corners[5], corners[6]],
                        color: darkenColor(baseColor, 0.2),
                        zDepth: 400
                    },
                    {
                        name: 'back',
                        points: [corners[0], corners[1], corners[5], corners[4]],
                        color: darkenColor(baseColor, 0.4),
                        zDepth: 300
                    }
                );
            } else if (offsetAngle >= 180 && offsetAngle < 270) {
                // 135-225도: 후면 + 좌측면
                visibleFaces.push(
                    {
                        name: 'back',
                        points: [corners[0], corners[1], corners[5], corners[4]],
                        color: darkenColor(baseColor, 0.4),
                        zDepth: 300
                    },
                    {
                        name: 'left',
                        points: [corners[0], corners[3], corners[7], corners[4]],
                        color: darkenColor(baseColor, 0.3),
                        zDepth: 200
                    }
                );
            } else {
                // 225-315도: 좌측면 + 정면
                visibleFaces.push(
                    {
                        name: 'left',
                        points: [corners[0], corners[3], corners[7], corners[4]],
                        color: darkenColor(baseColor, 0.3),
                        zDepth: 200
                    },
                    {
                        name: 'front',
                        points: [corners[3], corners[2], corners[6], corners[7]],
                        color: baseColor,
                        zDepth: 500
                    }
                );
            }

            // 바닥면 (높이가 낮을 때만)
            if (h <= 25) {
                visibleFaces.unshift({
                    name: 'bottom',
                    points: [corners[0], corners[1], corners[2], corners[3]],
                    color: darkenColor(baseColor, 0.5),
                    zDepth: 100
                });
            }

            // Z-depth로 정렬 (뒤에서 앞으로)
            visibleFaces.sort((a, b) => a.zDepth - b.zDepth);

            // 가시적인 면들 렌더링 (hover 효과 적용)
            visibleFaces.forEach(face => {
                faces.push(
                    <polygon
                        key={`${node.id}-${face.name}`}
                        points={face.points.map(p => `${p.x},${p.y}`).join(" ")}
                        fill={face.color}
                        stroke={isHovered ? '#ff6b35' : isSelected ? '#e74c3c' : '#333'}
                        strokeWidth={isHovered ? '3' : isSelected ? '2' : '1'}
                        filter={face.name === 'top' ? "url(#nodeShadow)" : undefined}
                        style={{
                            cursor: 'pointer',
                            transition: 'stroke 0.2s ease'
                        }}
                    />
                );
            });

            // 노드 라벨
            const labelPos = transformPoint(node.x, h + 20, node.z);
            faces.push(
                <text
                    key={`${node.id}-label`}
                    x={labelPos.x}
                    y={labelPos.y}
                    fill='#333'
                    fontSize='12'
                    fontWeight='bold'
                    textAnchor='middle'
                    fontFamily='Arial, sans-serif'>
                    {node.label}
                </text>
            );

            // 선택된 노드 표시 (yFiles 스타일 높이 핸들)
            if (isSelected) {
                const topPos = transformPoint(node.x, h, node.z);
                const handlePos = transformPoint(node.x, h + 30, node.z);
                
                // 높이 연결선
                faces.push(
                    <line
                        key={`${node.id}-height-line`}
                        x1={topPos.x}
                        y1={topPos.y}
                        x2={handlePos.x}
                        y2={handlePos.y}
                        stroke='#e74c3c'
                        strokeWidth='2'
                        strokeDasharray='3,3'
                    />
                );
                
                // 높이 핸들 (삼각형)
                faces.push(
                    <polygon
                        key={`${node.id}-handle`}
                        points={`${handlePos.x},${handlePos.y-8} ${handlePos.x-6},${handlePos.y+4} ${handlePos.x+6},${handlePos.y+4}`}
                        fill='#e74c3c'
                        stroke='#fff'
                        strokeWidth='2'
                        filter="url(#nodeShadow)"
                    />
                );
            }


            return (
                <g key={`node-${node.id}`} className='node-group'>
                    {faces}
                </g>
            );
        },
        [selectedNode, transformPoint, lightenColor, darkenColor, rotation, hoveredNode]
    );

    // 그리드 좌표로 스냅하는 함수
    const snapToGrid = useCallback((value: number, gridSize: number) => {
        return Math.round(value / gridSize) * gridSize;
    }, []);

    // 노드를 4칸 그리드 중앙에 배치하는 함수
    const getNodeGridPosition = useCallback((x: number, z: number) => {
        const gridSize = 60; // 기본 그리드 셀 크기
        const nodeGridSize = gridSize * 2; // 노드는 4칸(2x2) 차지
        return {
            x: snapToGrid(x, nodeGridSize),
            z: snapToGrid(z, nodeGridSize)
        };
    }, [snapToGrid]);

    // 등축 그리드 기반 Manhattan routing 계산 (그리드 선을 따라)
    const calculateManhattanPath = useCallback((sourceNode: NodeData, targetNode: NodeData) => {
        // 노드의 실제 그리드 위치
        const startGrid = getNodeGridPosition(sourceNode.x, sourceNode.z);
        const endGrid = getNodeGridPosition(targetNode.x, targetNode.z);
        
        const deltaX = endGrid.x - startGrid.x;
        const deltaZ = endGrid.z - startGrid.z;
        
        const pathPoints3D = [];
        
        // 시작점
        pathPoints3D.push({ x: startGrid.x, y: 0, z: startGrid.z });
        
        // Manhattan routing: 항상 그리드 선을 따라 이동
        if (deltaX !== 0 && deltaZ !== 0) {
            // 두 축 모두 이동해야 하는 경우
            if (Math.abs(deltaX) >= Math.abs(deltaZ)) {
                // X축 우선: X → Z 순서로 이동
                pathPoints3D.push({ x: endGrid.x, y: 0, z: startGrid.z });
            } else {
                // Z축 우선: Z → X 순서로 이동
                pathPoints3D.push({ x: startGrid.x, y: 0, z: endGrid.z });
            }
        }
        
        // 끝점
        pathPoints3D.push({ x: endGrid.x, y: 0, z: endGrid.z });
        
        // 3D 포인트들을 등축 투영으로 변환
        return pathPoints3D.map(point => transformPoint(point.x, point.y, point.z));
    }, [transformPoint, getNodeGridPosition]);

    // SVG 엣지 생성 (등축 그리드 기반 Manhattan routing 적용)
    const renderEdge = useCallback(
        (edge: EdgeData) => {
            const sourceNode = nodes.find((n) => n.id === edge.source);
            const targetNode = nodes.find((n) => n.id === edge.target);

            if (!sourceNode || !targetNode) return null;

            // 등축 그리드를 따라 경로 계산
            const pathPoints = calculateManhattanPath(sourceNode, targetNode);
            const pathString = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

            return (
                <g key={`edge-${edge.id}`} className='edge-group'>
                    {/* 엣지 그림자 */}
                    <path
                        d={pathString}
                        stroke='rgba(0,0,0,0.2)'
                        strokeWidth='4'
                        fill='none'
                        transform='translate(2, 2)'
                    />
                    {/* 메인 엣지 */}
                    <path
                        d={pathString}
                        stroke='url(#edgeGradient)'
                        strokeWidth='3'
                        fill='none'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                    />
                    {/* 화살표 (마지막 세그먼트에) */}
                    {pathPoints.length > 1 && (() => {
                        const lastPoint = pathPoints[pathPoints.length - 1];
                        const secondLastPoint = pathPoints[pathPoints.length - 2];
                        const angle = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
                        const arrowSize = 10;
                        
                        return (
                            <polygon
                                points={`0,0 ${-arrowSize},${-arrowSize/2} ${-arrowSize},${arrowSize/2}`}
                                fill='#555'
                                stroke='#333'
                                strokeWidth='0.5'
                                transform={`translate(${lastPoint.x}, ${lastPoint.y}) rotate(${angle * 180 / Math.PI})`}
                            />
                        );
                    })()}
                </g>
            );
        },
        [nodes, calculateManhattanPath]
    );

    // 마우스 이벤트 핸들러
    const handleMouseDown = useCallback(
        (event: React.MouseEvent<SVGSVGElement>) => {
            // 컨텍스트 메뉴가 열려있으면 닫기
            if (contextMenu) {
                setContextMenu(null);
            }

            const rect = svgRef.current?.getBoundingClientRect();
            if (!rect) return;

            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            // 노드 클릭 감지
            for (const node of nodes) {
                const nodePos = transformPoint(node.x, node.height * 50 / 2, node.z);
                const distance = Math.sqrt((mouseX - nodePos.x) ** 2 + (mouseY - nodePos.y) ** 2);

                if (distance < 50) {
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
        [nodes, transformPoint, onNodeSelect, contextMenu]
    );

    // 더블클릭으로 새 노드 생성
    const handleDoubleClick = useCallback(
        (event: React.MouseEvent<SVGSVGElement>) => {
            const rect = svgRef.current?.getBoundingClientRect();
            if (!rect) return;

            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            // 노드 클릭이 아닌 경우에만 새 노드 생성
            for (const node of nodes) {
                const nodePos = transformPoint(node.x, node.height * 50 / 2, node.z);
                const distance = Math.sqrt((mouseX - nodePos.x) ** 2 + (mouseY - nodePos.y) ** 2);
                if (distance < 50) return; // 노드를 클릭한 경우 새 노드 생성하지 않음
            }

            // 화면 좌표를 월드 좌표로 변환
            const worldX = (mouseX - width / 2 - camera.x) / camera.zoom;
            const worldY = (mouseY - height / 2 - camera.y) / camera.zoom;
            
            const worldPos = IsometricProjection.unproject(worldX, worldY);
            
            // 회전 역변환
            const rotRad = -(rotation * Math.PI) / 180;
            const finalX = worldPos.x * Math.cos(rotRad) - worldPos.z * Math.sin(rotRad);
            const finalZ = worldPos.x * Math.sin(rotRad) + worldPos.z * Math.cos(rotRad);

            if (onNodeAdd) {
                onNodeAdd(finalX, finalZ);
            }
        },
        [nodes, transformPoint, camera, width, height, rotation, onNodeAdd]
    );

    // 우클릭 컨텍스트 메뉴
    const handleContextMenu = useCallback(
        (event: React.MouseEvent<SVGSVGElement>) => {
            event.preventDefault();
            
            const rect = svgRef.current?.getBoundingClientRect();
            if (!rect) return;

            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            // 노드 위에서 우클릭한 경우
            for (const node of nodes) {
                const nodePos = transformPoint(node.x, node.height * 50 / 2, node.z);
                const distance = Math.sqrt((mouseX - nodePos.x) ** 2 + (mouseY - nodePos.y) ** 2);
                if (distance < 50) {
                    setContextMenu({
                        x: event.clientX,
                        y: event.clientY,
                        nodeId: node.id
                    });
                    return;
                }
            }
            
            // 빈 공간 우클릭 시 컨텍스트 메뉴 숨김
            setContextMenu(null);
        },
        [nodes, transformPoint]
    );

    const handleMouseMove = useCallback(
        (event: React.MouseEvent<SVGSVGElement>) => {
            const rect = svgRef.current?.getBoundingClientRect();
            if (!rect) return;

            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            
            // 마우스 위치 업데이트 (툴팁용)
            setMousePosition({ x: event.clientX, y: event.clientY });

            if (!isDragging) {
                // 드래그 중이 아닐 때 hover 처리
                let hitNode = null;
                
                for (const node of nodes) {
                    const nodePos = transformPoint(node.x, node.height * 50 / 2, node.z);
                    const distance = Math.sqrt((mouseX - nodePos.x) ** 2 + (mouseY - nodePos.y) ** 2);
                    if (distance < 50) {
                        hitNode = node;
                        break;
                    }
                }
                
                setHoveredNode(hitNode);
                return;
            }

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

                    // 그리드 스냅은 부모 컴포넌트에서 처리하므로 여기서는 원본 좌표 전달
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
            transformPoint,
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

    // Z-depth로 요소 정렬
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

    const sortedNodes = [...nodes].sort((a, b) => {
        const depthA = a.x + a.z;
        const depthB = b.x + b.z;
        return depthA - depthB;
    });

    return (
        <div className='svg-container'>
            <svg
                ref={svgRef}
                width={width}
                height={height}
                className='cursor-grab active:cursor-grabbing'
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                    handleMouseUp();
                    setHoveredNode(null);
                    setContextMenu(null);
                }}
                onDoubleClick={handleDoubleClick}
                onContextMenu={handleContextMenu}
                onWheel={handleWheel}>
                
                {/* SVG 그라데이션 및 필터 정의 */}
                <defs>
                    {/* 노드 그림자 */}
                    <filter id="nodeShadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.3"/>
                    </filter>
                    
                    {/* 엣지 그라데이션 */}
                    <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#666" stopOpacity="0.8"/>
                        <stop offset="50%" stopColor="#999" stopOpacity="1"/>
                        <stop offset="100%" stopColor="#666" stopOpacity="0.8"/>
                    </linearGradient>
                    
                    {/* 그리드 그라데이션 */}
                    <linearGradient id="gridGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#d0d0d0" stopOpacity="0.5"/>
                        <stop offset="100%" stopColor="#e0e0e0" stopOpacity="0.3"/>
                    </linearGradient>
                </defs>

                {/* 배경 그리드 */}
                {renderGrid()}

                {/* 엣지 (g 태그로 그룹화) */}
                {sortedEdges.map((edge) => renderEdge(edge))}

                {/* 노드 (rect 기반, g 태그로 그룹화) */}
                {sortedNodes.map((node) => renderNode(node))}
            </svg>
            
            {/* Hover 툴팁 */}
            {hoveredNode && (
                <div
                    className="tooltip"
                    style={{
                        left: mousePosition.x + 15,
                        top: mousePosition.y - 10,
                        transform: 'translateY(-100%)'
                    }}>
                    <div className="tooltip-title">{hoveredNode.label}</div>
                    <div className="tooltip-details">
                        <div>높이: <strong>{hoveredNode.height.toFixed(1)}</strong></div>
                        <div>위치: <strong>({hoveredNode.x.toFixed(0)}, {hoveredNode.z.toFixed(0)})</strong></div>
                        <div className="tooltip-hint">클릭하여 상세정보 보기</div>
                    </div>
                </div>
            )}
            

            {/* 컨텍스트 메뉴 */}
            {contextMenu && (
                <div
                    className="context-menu"
                    style={{
                        left: contextMenu.x,
                        top: contextMenu.y,
                        transform: 'translate(-10px, 10px)'
                    }}
                    onMouseLeave={() => setContextMenu(null)}
                >
                    <button
                        onClick={() => {
                            if (onNodeDelete) {
                                onNodeDelete(contextMenu.nodeId);
                            }
                            setContextMenu(null);
                        }}
                    >
                        <span className="text-red-500">🗑️</span>
                        노드 삭제
                    </button>
                </div>
            )}
        </div>
    );
}
