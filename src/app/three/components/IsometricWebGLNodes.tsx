"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";

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

// Canvas 배경 + WebGL 노드 하이브리드 렌더러
interface IsometricWebGLNodesProps {
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

export default function IsometricWebGLNodes({
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
}: IsometricWebGLNodesProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const webglContainerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [dragNodeId, setDragNodeId] = useState<string | null>(null);
    const [dragMode, setDragMode] = useState<"camera" | "height" | "position">("camera");
    const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });

    // Three.js 씬 관리
    const threeSceneRef = useRef<{
        scene: THREE.Scene;
        camera: THREE.OrthographicCamera;
        renderer: THREE.WebGLRenderer;
        nodeMeshes: Map<string, THREE.Mesh>;
    } | null>(null);

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

    // Three.js 초기화
    useEffect(() => {
        if (!webglContainerRef.current) return;

        // Scene 생성
        const scene = new THREE.Scene();
        scene.background = null; // 투명 배경

        // 등축 투영 카메라 (Orthographic Camera)
        const camera = new THREE.OrthographicCamera(
            -width / 2,
            width / 2,
            height / 2,
            -height / 2,
            0.1,
            1000
        );
        camera.position.set(0, 0, 100);

        // WebGL Renderer
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true, // 투명 배경
            premultipliedAlpha: false,
        });
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0); // 완전 투명
        webglContainerRef.current.appendChild(renderer.domElement);

        // 조명 설정
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        scene.add(directionalLight);

        threeSceneRef.current = {
            scene,
            camera,
            renderer,
            nodeMeshes: new Map(),
        };

        return () => {
            if (webglContainerRef.current?.contains(renderer.domElement)) {
                webglContainerRef.current.removeChild(renderer.domElement);
            }
            renderer.dispose();
        };
    }, [width, height]);

    // Canvas 배경 및 그리드 그리기
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // 화면 클리어 및 배경색
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        // 안티앨리어싱
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // 그리드 그리기
        if (showGrid) {
            const gridSize = 15;
            const cellSize = 60;

            ctx.strokeStyle = "#d0d0d0";
            ctx.lineWidth = 0.8;
            ctx.beginPath();

            for (let i = -gridSize; i <= gridSize; i++) {
                for (let j = -gridSize; j <= gridSize; j++) {
                    const x = i * cellSize;
                    const z = j * cellSize;

                    if (j < gridSize) {
                        const start = transformPoint(x, 0, z);
                        const end = transformPoint(x, 0, z + cellSize);
                        ctx.moveTo(start.x, start.y);
                        ctx.lineTo(end.x, end.y);
                    }

                    if (i < gridSize) {
                        const start = transformPoint(x, 0, z);
                        const end = transformPoint(x + cellSize, 0, z);
                        ctx.moveTo(start.x, start.y);
                        ctx.lineTo(end.x, end.y);
                    }
                }
            }

            ctx.stroke();

            // 메인 축 강조
            ctx.strokeStyle = "#a0a0a0";
            ctx.lineWidth = 1.5;
            ctx.beginPath();

            const xStart = transformPoint(-gridSize * cellSize, 0, 0);
            const xEnd = transformPoint(gridSize * cellSize, 0, 0);
            const zStart = transformPoint(0, 0, -gridSize * cellSize);
            const zEnd = transformPoint(0, 0, gridSize * cellSize);

            ctx.moveTo(xStart.x, xStart.y);
            ctx.lineTo(xEnd.x, xEnd.y);
            ctx.moveTo(zStart.x, zStart.y);
            ctx.lineTo(zEnd.x, zEnd.y);

            ctx.stroke();
        }

        // 엣지 그리기
        edges.forEach((edge) => {
            const sourceNode = nodes.find((n) => n.id === edge.source);
            const targetNode = nodes.find((n) => n.id === edge.target);

            if (!sourceNode || !targetNode) return;

            const sourcePos = transformPoint(sourceNode.x, 0, sourceNode.z);
            const targetPos = transformPoint(targetNode.x, 0, targetNode.z);

            // 그림자
            ctx.strokeStyle = "#bdc3c7";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(sourcePos.x + 1, sourcePos.y + 1);
            ctx.lineTo(targetPos.x + 1, targetPos.y + 1);
            ctx.stroke();

            // 메인 엣지
            ctx.strokeStyle = "#34495e";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(sourcePos.x, sourcePos.y);
            ctx.lineTo(targetPos.x, targetPos.y);
            ctx.stroke();
        });
    }, [showGrid, transformPoint, width, height, edges, nodes]);

    // WebGL 노드 업데이트
    const updateWebGLNodes = useCallback(() => {
        const threeScene = threeSceneRef.current;
        if (!threeScene) return;

        const { scene, renderer, camera, nodeMeshes } = threeScene;

        // 기존 노드 메시 제거
        nodeMeshes.forEach((mesh) => {
            scene.remove(mesh);
            mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach((m) => m.dispose());
            } else {
                mesh.material.dispose();
            }
        });
        nodeMeshes.clear();

        // 새 노드 메시 생성
        nodes.forEach((node) => {
            const w = node.width || 50;
            const d = node.depth || 50;
            const h = node.height * 50;

            // Perfect BoxGeometry (완벽한 정육면체)
            const geometry = new THREE.BoxGeometry(w, h, d);

            // 색상 처리
            const baseColor = selectedNode === node.id ? "#ffffff" : node.color;
            const color = new THREE.Color(baseColor);

            // MeshPhongMaterial (완벽한 3D 렌더링)
            const material = new THREE.MeshPhongMaterial({
                color: color,
                shininess: 30,
                transparent: false,
            });

            const mesh = new THREE.Mesh(geometry, material);

            // 등축 투영 위치 계산
            const rotRad = (rotation * Math.PI) / 180;
            const rotatedX = node.x * Math.cos(rotRad) - node.z * Math.sin(rotRad);
            const rotatedZ = node.x * Math.sin(rotRad) + node.z * Math.cos(rotRad);
            const projected = IsometricProjection.project(rotatedX, h / 2, rotatedZ);

            // WebGL 좌표계로 변환
            const screenX = projected.x * camera.zoom;
            const screenY = -projected.y * camera.zoom; // Y축 뒤집기

            mesh.position.set(screenX, screenY, 0);

            // 등축 투영 회전 적용
            mesh.rotation.x = Math.atan(Math.sin(Math.PI / 6)); // ~35.26도
            mesh.rotation.y = Math.PI / 4; // 45도

            scene.add(mesh);
            nodeMeshes.set(node.id, mesh);
        });

        // 렌더링
        renderer.render(scene, camera);
    }, [nodes, selectedNode, rotation, camera.zoom]);

    // Canvas 렌더링
    useEffect(() => {
        drawCanvas();
    }, [drawCanvas]);

    // WebGL 노드 업데이트
    useEffect(() => {
        updateWebGLNodes();
    }, [updateWebGLNodes]);

    // 마우스 이벤트 핸들러
    const handleMouseDown = useCallback(
        (event: React.MouseEvent) => {
            const rect = canvasRef.current?.getBoundingClientRect();
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
        (event: React.MouseEvent) => {
            if (!isDragging) return;

            const rect = canvasRef.current?.getBoundingClientRect();
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

    const handleWheel = useCallback((event: React.WheelEvent) => {
        event.preventDefault();
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        setCamera((prev) => ({
            ...prev,
            zoom: Math.max(0.1, Math.min(3, prev.zoom * zoomFactor)),
        }));
    }, []);

    return (
        <div className='relative w-full h-full bg-white'>
            {/* Canvas 배경 레이어 (그리드, 엣지) */}
            <canvas
                ref={canvasRef}
                width={width * 2}
                height={height * 2}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: width,
                    height: height,
                    pointerEvents: "auto",
                }}
                className='cursor-grab active:cursor-grabbing'
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            />

            {/* WebGL 노드 레이어 (완벽한 3D 정육면체) */}
            <div
                ref={webglContainerRef}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: width,
                    height: height,
                    pointerEvents: "none", // Canvas가 이벤트 처리
                }}
            />
        </div>
    );
}
