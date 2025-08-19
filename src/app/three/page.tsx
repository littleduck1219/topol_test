"use client";

import React, { useState, useEffect } from "react";
import IsometricSVGPure from "./components/IsometricSVGPure";

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

// 그리드에 정렬된 기본 그래프 데이터 (120px 간격 = 2x2 그리드)
const defaultNodes: NodeData[] = [
    { id: "1", x: 0, z: 0, height: 1, color: "#4285f4", label: "Development" },
    { id: "2", x: 240, z: 0, height: 2, color: "#ea4335", label: "Management" },
    { id: "3", x: 480, z: 0, height: 1.5, color: "#34a853", label: "Production" },
    { id: "4", x: 120, z: 240, height: 0.8, color: "#fbbc04", label: "Sales" },
    { id: "5", x: 360, z: 240, height: 2.5, color: "#ff6d01", label: "IT" },
];

const defaultEdges: EdgeData[] = [
    { id: "e1", source: "1", target: "2" },
    { id: "e2", source: "2", target: "3" },
    { id: "e3", source: "1", target: "4" },
    { id: "e4", source: "4", target: "5" },
    { id: "e5", source: "2", target: "5" },
];

export default function IsometricTopologyPage() {
    const [nodes, setNodes] = useState<NodeData[]>(defaultNodes);
    const [edges] = useState<EdgeData[]>(defaultEdges);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [rotation, setRotation] = useState(0);
    const [showGrid, setShowGrid] = useState(true);
    const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

    useEffect(() => {
        const updateDimensions = () => {
            setDimensions({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        updateDimensions();
        window.addEventListener("resize", updateDimensions);
        return () => window.removeEventListener("resize", updateDimensions);
    }, []);

    const handleNodeSelect = (id: string) => {
        setSelectedNode(id === selectedNode ? null : id);
    };

    const handleNodeHeightChange = (id: string, height: number) => {
        setNodes((prev) => prev.map((node) => (node.id === id ? { ...node, height } : node)));
    };

    const handleNodePositionChange = (id: string, x: number, z: number) => {
        // 그리드에 스냅 (120px 간격)
        const gridSize = 120;
        const snappedX = Math.round(x / gridSize) * gridSize;
        const snappedZ = Math.round(z / gridSize) * gridSize;
        setNodes((prev) => prev.map((node) => (node.id === id ? { ...node, x: snappedX, z: snappedZ } : node)));
    };

    const handleLayoutChange = (type: "hierarchical" | "orthogonal") => {
        const gridSpacing = 120; // 그리드 간격
        
        if (type === "hierarchical") {
            const layoutNodes = [...nodes].map((node, index) => ({
                ...node,
                x: index * gridSpacing,
                z: Math.floor(index / 3) * gridSpacing,
            }));
            setNodes(layoutNodes);
        } else if (type === "orthogonal") {
            const gridSize = Math.ceil(Math.sqrt(nodes.length));
            const layoutNodes = [...nodes].map((node, index) => ({
                ...node,
                x: (index % gridSize) * gridSpacing,
                z: Math.floor(index / gridSize) * gridSpacing,
            }));
            setNodes(layoutNodes);
        }
    };

    const handleAddNode = (x?: number, z?: number) => {
        const colors = ["#4285f4", "#ea4335", "#34a853", "#fbbc04", "#ff6d01", "#9c27b0"];
        const newNode: NodeData = {
            id: `node-${Date.now()}`,
            x: x ?? Math.random() * 400 - 200,
            z: z ?? Math.random() * 400 - 200,
            height: Math.random() * 2 + 0.5,
            color: colors[Math.floor(Math.random() * colors.length)],
            label: `Node ${nodes.length + 1}`,
        };
        setNodes((prev) => [...prev, newNode]);
    };

    const handleNodeAdd = (x: number, z: number) => {
        // 그리드에 스냅 (120px 간격)
        const gridSize = 120;
        const snappedX = Math.round(x / gridSize) * gridSize;
        const snappedZ = Math.round(z / gridSize) * gridSize;
        handleAddNode(snappedX, snappedZ);
    };

    const handleNodeDelete = (id: string) => {
        setNodes((prev) => prev.filter((node) => node.id !== id));
        // 삭제된 노드가 선택되어 있다면 선택 해제
        if (selectedNode === id) {
            setSelectedNode(null);
        }
    };

    return (
        <div className='page-container'>
            {/* 컨트롤 패널 */}
            <div className='control-panel'>
                <h3>토폴로지 컨트롤</h3>

                <div className='control-group'>
                    <label>
                        회전: {rotation}°
                    </label>
                    <input
                        type='range'
                        min='0'
                        max='360'
                        value={rotation}
                        onChange={(e) => setRotation(Number(e.target.value))}
                    />
                </div>

                <div className='control-group'>
                    <button
                        onClick={() => setShowGrid(!showGrid)}
                        className={showGrid ? 'btn-primary' : 'btn-secondary'}>
                        그리드 {showGrid ? "OFF" : "ON"}
                    </button>
                </div>

                <div className='control-group'>
                    <label>레이아웃:</label>
                    <div className='button-group'>
                        <button
                            onClick={() => handleLayoutChange("hierarchical")}
                            className='btn-success'>
                            계층적
                        </button>
                        <button
                            onClick={() => handleLayoutChange("orthogonal")}
                            className='btn-purple'>
                            직교
                        </button>
                    </div>
                </div>

                <div className='control-group'>
                    <button
                        onClick={() => handleAddNode()}
                        className='btn-orange'>
                        노드 추가
                    </button>
                </div>

                <div className='usage-guide'>
                    <span className='guide-title'>사용법:</span>
                    • 더블클릭: 새 노드 생성<br />
                    • 노드 클릭: 선택 및 이동<br />
                    • 우클릭: 노드 삭제 메뉴<br />
                    • Shift + 드래그: 높이 조절<br />
                    • 빈 공간 드래그: 화면 이동<br />
                    • 마우스 휠: 줌
                </div>
            </div>

            {/* Isometric SVG Pure (yFiles 스타일) */}
            <IsometricSVGPure
                nodes={nodes}
                edges={edges}
                selectedNode={selectedNode}
                onNodeSelect={handleNodeSelect}
                onNodeHeightChange={handleNodeHeightChange}
                onNodePositionChange={handleNodePositionChange}
                onNodeAdd={handleNodeAdd}
                onNodeDelete={handleNodeDelete}
                showGrid={showGrid}
                rotation={rotation}
                width={dimensions.width}
                height={dimensions.height}
            />

            {/* 정보 패널 */}
            <div className='absolute top-6 right-6 bg-white p-5 rounded-xl shadow-xl border border-gray-100 z-10 backdrop-blur-sm min-w-[250px]'>
                <h4 className='font-bold text-lg text-gray-900 mb-4 border-b border-gray-100 pb-2'>그래프 정보</h4>
                <div className='space-y-3'>
                    <div className='flex justify-between items-center'>
                        <span className='text-sm text-gray-600 font-medium'>노드:</span>
                        <span className='text-sm font-bold text-gray-900 bg-blue-50 px-2 py-1 rounded'>{nodes.length}개</span>
                    </div>
                    <div className='flex justify-between items-center'>
                        <span className='text-sm text-gray-600 font-medium'>엣지:</span>
                        <span className='text-sm font-bold text-gray-900 bg-green-50 px-2 py-1 rounded'>{edges.length}개</span>
                    </div>
                    {selectedNode ? (
                        <div className='selected-node-info'>
                            <div className='selected-title'>선택된 노드</div>
                            {(() => {
                                const selectedNodeData = nodes.find(n => n.id === selectedNode);
                                return selectedNodeData ? (
                                    <div className='node-details'>
                                        <div><strong>이름:</strong> {selectedNodeData.label}</div>
                                        <div><strong>ID:</strong> {selectedNodeData.id}</div>
                                        <div><strong>높이:</strong> {selectedNodeData.height.toFixed(2)}</div>
                                        <div><strong>위치:</strong> ({selectedNodeData.x}, {selectedNodeData.z})</div>
                                    </div>
                                ) : null;
                            })()}
                        </div>
                    ) : (
                        <div className='info-row'>
                            <span className='label'>선택:</span>
                            <span className='value gray'>없음</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
