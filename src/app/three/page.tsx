'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface NodeData {
    id: string;
    label: string;
    type: 'router' | 'switch' | 'server' | 'client' | 'group';
    parent?: string;
    position?: THREE.Vector3;
    info?: string;
    isMainNode?: boolean;
    details?: any;
}

interface EdgeData {
    id: string;
    source: string;
    target: string;
}

function Page() {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<any>(null);
    const nodesRef = useRef<Map<string, THREE.Object3D>>(new Map());
    const edgesRef = useRef<THREE.Object3D[]>([]);
    const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
    const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
    
    const [tooltip, setTooltip] = useState<{visible: boolean, x: number, y: number, content: string}>({
        visible: false, x: 0, y: 0, content: ''
    });
    const [clickTooltip, setClickTooltip] = useState<{visible: boolean, x: number, y: number, nodeData: any}>({
        visible: false, x: 0, y: 0, nodeData: null
    });
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isAutoCollapse, setIsAutoCollapse] = useState(true);
    const [currentZoom, setCurrentZoom] = useState(1);
    const [selectedNode, setSelectedNode] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [dragMode, setDragMode] = useState(false);
    const [draggedNode, setDraggedNode] = useState<THREE.Object3D | null>(null);
    const [dragPlane, setDragPlane] = useState<THREE.Plane>(new THREE.Plane());

    // 네트워크 데이터
    const networkData = {
        nodes: [
            // 그룹 노드들
            { 
                id: 'group1', 
                label: 'Core Network',
                type: 'group' as const,
                info: 'Core network infrastructure containing main routers'
            },
            { 
                id: 'group2', 
                label: 'Branch A',
                type: 'group' as const,
                info: 'Branch A network segment with local services'
            },
            { 
                id: 'group3', 
                label: 'Branch B',
                type: 'group' as const,
                info: 'Branch B network segment with client devices'
            },
            // 실제 노드들
            { 
                id: 'router1', 
                label: 'Router 1', 
                parent: 'group1',
                type: 'router' as const,
                info: 'Main core router - 10.0.0.1\nUptime: 99.9%\nTraffic: 1.2 Gbps',
                isMainNode: true,
                details: {
                    name: 'Core Router 1',
                    ip: '10.0.0.1',
                    mac: '00:1B:44:11:3A:B7',
                    model: 'Cisco ISR 4431',
                    os: 'Cisco IOS XE 16.12',
                    uptime: '365 days, 12 hours',
                    traffic: '1.2 Gbps',
                    cpu: '15%',
                    memory: '2.1GB / 4GB',
                    temperature: '45°C',
                    ports: [
                        { name: 'GigabitEthernet0/0/0', status: 'up', speed: '1Gbps' },
                        { name: 'GigabitEthernet0/0/1', status: 'up', speed: '1Gbps' },
                        { name: 'GigabitEthernet0/0/2', status: 'down', speed: '1Gbps' }
                    ],
                    protocols: ['OSPF', 'BGP', 'HSRP'],
                    location: 'Data Center A - Rack 1'
                }
            },
            { 
                id: 'router2', 
                label: 'Router 2', 
                parent: 'group1',
                type: 'router' as const,
                info: 'Secondary core router - 10.0.0.2\nUptime: 99.8%\nTraffic: 800 Mbps',
                isMainNode: false
            },
            { 
                id: 'router3', 
                label: 'Router 3', 
                parent: 'group1',
                type: 'router' as const,
                info: 'Backup core router - 10.0.0.3\nUptime: 99.7%\nTraffic: 200 Mbps',
                isMainNode: false
            },
            { 
                id: 'switch1', 
                label: 'Switch 1', 
                parent: 'group2',
                type: 'switch' as const,
                info: 'Branch A switch - 10.1.0.1\nPorts: 24\nVLANs: 5',
                isMainNode: true,
                details: {
                    name: 'Branch A Switch',
                    ip: '10.1.0.1',
                    mac: '00:1B:44:22:5C:D8',
                    model: 'Cisco Catalyst 2960-X',
                    os: 'Cisco IOS 15.2(7)E',
                    uptime: '180 days, 8 hours',
                    ports_total: 24,
                    ports_active: 18,
                    vlans: [
                        { id: 1, name: 'default', ports: 10 },
                        { id: 10, name: 'servers', ports: 4 },
                        { id: 20, name: 'clients', ports: 8 }
                    ],
                    cpu: '8%',
                    memory: '128MB / 256MB',
                    temperature: '38°C',
                    spanning_tree: 'RSTP',
                    location: 'Building A - Floor 2'
                }
            },
            { 
                id: 'server1', 
                label: 'Server 1', 
                parent: 'group2',
                type: 'server' as const,
                info: 'File server - 10.1.0.10\nOS: Ubuntu 22.04\nCPU: 85%\nRAM: 12GB/16GB',
                isMainNode: false
            },
            { 
                id: 'client1', 
                label: 'Client 1', 
                parent: 'group2',
                type: 'client' as const,
                info: 'Workstation 1 - 10.1.0.101\nOS: Windows 11\nUser: Alice',
                isMainNode: false
            },
            { 
                id: 'client2', 
                label: 'Client 2', 
                parent: 'group2',
                type: 'client' as const,
                info: 'Workstation 2 - 10.1.0.102\nOS: Windows 11\nUser: Bob',
                isMainNode: false
            },
            { 
                id: 'switch2', 
                label: 'Switch 2', 
                parent: 'group3',
                type: 'switch' as const,
                info: 'Branch B switch - 10.2.0.1\nPorts: 16\nVLANs: 3',
                isMainNode: true
            },
            { 
                id: 'server2', 
                label: 'Server 2', 
                parent: 'group3',
                type: 'server' as const,
                info: 'Web server - 10.2.0.10\nOS: CentOS 8\nCPU: 45%\nRAM: 8GB/16GB',
                isMainNode: false
            },
            { 
                id: 'client3', 
                label: 'Client 3', 
                parent: 'group3',
                type: 'client' as const,
                info: 'Laptop - 10.2.0.101\nOS: macOS\nUser: Charlie',
                isMainNode: false
            }
        ] as NodeData[],
        edges: [
            { id: 'e1', source: 'router1', target: 'router2' },
            { id: 'e2', source: 'router2', target: 'router3' },
            { id: 'e3', source: 'router1', target: 'switch1' },
            { id: 'e4', source: 'router2', target: 'switch2' },
            { id: 'e5', source: 'switch1', target: 'server1' },
            { id: 'e6', source: 'switch2', target: 'server2' },
            { id: 'e7', source: 'switch1', target: 'client1' },
            { id: 'e8', source: 'switch1', target: 'client2' },
            { id: 'e9', source: 'switch2', target: 'client3' }
        ] as EdgeData[]
    };

    // Three.js 초기화 및 씬 구성
    useEffect(() => {
        if (!mountRef.current) return;

        // 씬, 카메라, 렌더러 설정
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf8f9fa);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        camera.position.set(0, 10, 15);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        rendererRef.current = renderer;
        mountRef.current.appendChild(renderer.domElement);

        // 조명 설정
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        scene.add(directionalLight);

        // 그룹 위치 정의
        const groupPositions = {
            'group1': { x: 0, z: 0 },
            'group2': { x: -8, z: 0 },
            'group3': { x: 8, z: 0 }
        };

        // 노드 생성 함수
        const createNodeGeometry = (type: string) => {
            switch (type) {
                case 'router':
                    return new THREE.BoxGeometry(1.5, 0.8, 1.5);
                case 'switch':
                    return new THREE.BoxGeometry(2, 0.5, 1);
                case 'server':
                    return new THREE.BoxGeometry(1, 2, 1);
                case 'client':
                    return new THREE.SphereGeometry(0.6, 16, 16);
                default:
                    return new THREE.BoxGeometry(1, 1, 1);
            }
        };

        const getNodeColor = (type: string) => {
            switch (type) {
                case 'router':
                    return 0xe74c3c;
                case 'switch':
                    return 0x3498db;
                case 'server':
                    return 0x2ecc71;
                case 'client':
                    return 0xf39c12;
                default:
                    return 0x666666;
            }
        };

        // 노드 배치 함수
        const arrangeNodesInGroup = (groupId: string, nodes: NodeData[]) => {
            const groupCenter = groupPositions[groupId as keyof typeof groupPositions];
            const nodeCount = nodes.length;
            const radius = Math.max(2, nodeCount * 0.8);
            
            return nodes.map((node, index) => {
                const angle = (index / nodeCount) * Math.PI * 2;
                const x = groupCenter.x + Math.cos(angle) * radius;
                const z = groupCenter.z + Math.sin(angle) * radius;
                const y = 0.5;
                
                return { ...node, position: new THREE.Vector3(x, y, z) };
            });
        };

        // 그룹별로 노드 분류 및 배치
        const groupedNodes = networkData.nodes.reduce((groups, node) => {
            if (node.type === 'group') return groups;
            
            const groupId = node.parent || 'default';
            if (!groups[groupId]) groups[groupId] = [];
            groups[groupId].push(node);
            return groups;
        }, {} as Record<string, NodeData[]>);

        // 모든 노드에 위치 할당
        const positionedNodes: NodeData[] = [];
        Object.entries(groupedNodes).forEach(([groupId, nodes]) => {
            const arranged = arrangeNodesInGroup(groupId, nodes);
            positionedNodes.push(...arranged);
        });

        // 3D 노드 객체 생성
        positionedNodes.forEach((nodeData) => {
            const geometry = createNodeGeometry(nodeData.type);
            const material = new THREE.MeshLambertMaterial({ 
                color: getNodeColor(nodeData.type),
                transparent: true,
                opacity: 0.9
            });
            
            const nodeMesh = new THREE.Mesh(geometry, material);
            nodeMesh.position.copy(nodeData.position!);
            nodeMesh.castShadow = true;
            nodeMesh.receiveShadow = true;
            
            // 노드 데이터를 메시에 저장
            (nodeMesh as any).userData = nodeData;
            
            // 메인 노드인 경우 테두리 추가
            if (nodeData.isMainNode) {
                const edgeGeometry = createNodeGeometry(nodeData.type);
                const edgeMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.8,
                    wireframe: true
                });
                const edgeMesh = new THREE.Mesh(edgeGeometry, edgeMaterial);
                edgeMesh.scale.setScalar(1.1);
                nodeMesh.add(edgeMesh);
            }
            
            // 레이블 텍스트 추가
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            canvas.width = 256;
            canvas.height = 64;
            context.fillStyle = 'rgba(0, 0, 0, 0.8)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = 'white';
            context.font = '20px Arial';
            context.textAlign = 'center';
            context.fillText(nodeData.label, canvas.width / 2, canvas.height / 2 + 6);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(0, 1.5, 0);
            sprite.scale.set(2, 0.5, 1);
            nodeMesh.add(sprite);
            
            scene.add(nodeMesh);
            nodesRef.current.set(nodeData.id, nodeMesh);
        });

        // 그룹 영역 표시
        Object.entries(groupPositions).forEach(([groupId, position]) => {
            const groupData = networkData.nodes.find(n => n.id === groupId);
            if (!groupData) return;
            
            // 그룹 바닥 평면
            const planeGeometry = new THREE.PlaneGeometry(12, 8);
            const planeMaterial = new THREE.MeshLambertMaterial({ 
                color: 0xdddddd,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            });
            const plane = new THREE.Mesh(planeGeometry, planeMaterial);
            plane.rotation.x = -Math.PI / 2;
            plane.position.set(position.x, 0, position.z);
            scene.add(plane);
            
            // 그룹 레이블
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            canvas.width = 512;
            canvas.height = 128;
            context.fillStyle = 'rgba(255, 255, 255, 0.9)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = '#333';
            context.font = 'bold 32px Arial';
            context.textAlign = 'center';
            context.fillText(groupData.label, canvas.width / 2, canvas.height / 2 + 10);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(position.x, 4, position.z - 4);
            sprite.scale.set(4, 1, 1);
            scene.add(sprite);
        });

        // 연결선(엣지) 생성
        networkData.edges.forEach((edgeData) => {
            const sourceNode = nodesRef.current.get(edgeData.source);
            const targetNode = nodesRef.current.get(edgeData.target);
            
            if (!sourceNode || !targetNode) return;
            
            const sourcePos = sourceNode.position;
            const targetPos = targetNode.position;
            
            // 곡선 연결선 생성
            const curve = new THREE.QuadraticBezierCurve3(
                sourcePos,
                new THREE.Vector3(
                    (sourcePos.x + targetPos.x) / 2,
                    Math.max(sourcePos.y, targetPos.y) + 2,
                    (sourcePos.z + targetPos.z) / 2
                ),
                targetPos
            );
            
            const points = curve.getPoints(50);
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ 
                color: 0xcccccc,
                transparent: true,
                opacity: 0.8
            });
            
            const line = new THREE.Line(geometry, material);
            line.userData = { type: 'edge', ...edgeData };
            scene.add(line);
            edgesRef.current.push(line);
        });

        // 고급 마우스 상호작용 구현
        let isDragging = false;
        let isNodeDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        let draggedNodeRef: THREE.Object3D | null = null;
        let dragOffset = new THREE.Vector3();
        
        // 카메라 애니메이션을 위한 변수들
        let animationId: number | null = null;
        
        // 노드로 카메라 포커스 애니메이션
        const focusOnNode = (nodePosition: THREE.Vector3) => {
            const startPosition = camera.position.clone();
            const targetPosition = nodePosition.clone().add(new THREE.Vector3(5, 5, 5));
            const duration = 1000; // 1초
            const startTime = Date.now();
            
            const animateCamera = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Easing function
                const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                const easedProgress = easeInOut(progress);
                
                camera.position.lerpVectors(startPosition, targetPosition, easedProgress);
                camera.lookAt(nodePosition);
                
                if (progress < 1) {
                    animationId = requestAnimationFrame(animateCamera);
                }
            };
            
            animateCamera();
        };
        
        // 그룹 중심으로 줌인 애니메이션
        const focusOnGroup = (groupPosition: { x: number, z: number }) => {
            const startPosition = camera.position.clone();
            const targetPosition = new THREE.Vector3(groupPosition.x, 8, groupPosition.z + 12);
            const duration = 1000;
            const startTime = Date.now();
            
            const animateCamera = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                const easedProgress = easeInOut(progress);
                
                camera.position.lerpVectors(startPosition, targetPosition, easedProgress);
                camera.lookAt(groupPosition.x, 0, groupPosition.z);
                
                if (progress < 1) {
                    animationId = requestAnimationFrame(animateCamera);
                }
            };
            
            animateCamera();
        };
        
        // 마우스 위치를 3D 평면으로 변환
        const getMousePosition3D = (event: MouseEvent, targetY: number = 0) => {
            const rect = renderer.domElement.getBoundingClientRect();
            mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            raycasterRef.current.setFromCamera(mouseRef.current, camera);
            
            // Y=targetY 평면과의 교차점 계산
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -targetY);
            const intersection = new THREE.Vector3();
            raycasterRef.current.ray.intersectPlane(plane, intersection);
            
            return intersection;
        };
        
        const handleMouseDown = (event: MouseEvent) => {
            const rect = renderer.domElement.getBoundingClientRect();
            mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            raycasterRef.current.setFromCamera(mouseRef.current, camera);
            const intersects = raycasterRef.current.intersectObjects(Array.from(nodesRef.current.values()));
            
            if (intersects.length > 0 && !event.shiftKey) {
                // 노드 드래그 시작
                const selectedObject = intersects[0].object;
                isNodeDragging = true;
                draggedNodeRef = selectedObject;
                setDraggedNode(selectedObject);
                
                // 드래그 오프셋 계산
                const mousePos3D = getMousePosition3D(event, selectedObject.position.y);
                dragOffset.subVectors(selectedObject.position, mousePos3D);
                
                renderer.domElement.style.cursor = 'grabbing';
            } else if (event.shiftKey) {
                // Shift+드래그: 카메라 회전 시작
                isDragging = true;
                previousMousePosition = { x: event.clientX, y: event.clientY };
                renderer.domElement.style.cursor = 'grabbing';
            }
        };
        
        const handleMouseMove = (event: MouseEvent) => {
            const rect = renderer.domElement.getBoundingClientRect();
            mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            if (isNodeDragging && draggedNodeRef) {
                // 노드 드래그 처리
                const mousePos3D = getMousePosition3D(event, draggedNodeRef.position.y);
                const newPosition = mousePos3D.add(dragOffset);
                const deltaPosition = new THREE.Vector3().subVectors(newPosition, draggedNodeRef.position);
                
                // Alt 키가 눌려있으면 그룹 전체 이동
                if (event.altKey && draggedNodeRef.userData.parent) {
                    const parentGroup = draggedNodeRef.userData.parent;
                    
                    // 같은 그룹의 모든 노드 이동
                    nodesRef.current.forEach((nodeMesh, nodeId) => {
                        if (nodeMesh.userData.parent === parentGroup) {
                            nodeMesh.position.add(deltaPosition);
                        }
                    });
                } else {
                    // 개별 노드만 이동
                    draggedNodeRef.position.copy(newPosition);
                }
                
                // 연결된 엣지 업데이트
                if (event.altKey && draggedNodeRef.userData.parent) {
                    // 그룹 이동 시 그룹과 관련된 모든 엣지 업데이트
                    const parentGroup = draggedNodeRef.userData.parent;
                    const groupNodes = Array.from(nodesRef.current.values()).filter(
                        node => node.userData.parent === parentGroup
                    );
                    const groupNodeIds = groupNodes.map(node => node.userData.id);
                    
                    edgesRef.current.forEach((edge) => {
                        if (groupNodeIds.includes(edge.userData.source) || groupNodeIds.includes(edge.userData.target)) {
                            const sourceNode = nodesRef.current.get(edge.userData.source);
                            const targetNode = nodesRef.current.get(edge.userData.target);
                            
                            if (sourceNode && targetNode) {
                                const sourcePos = sourceNode.position;
                                const targetPos = targetNode.position;
                                
                                const curve = new THREE.QuadraticBezierCurve3(
                                    sourcePos,
                                    new THREE.Vector3(
                                        (sourcePos.x + targetPos.x) / 2,
                                        Math.max(sourcePos.y, targetPos.y) + 2,
                                        (sourcePos.z + targetPos.z) / 2
                                    ),
                                    targetPos
                                );
                                
                                const points = curve.getPoints(50);
                                (edge as THREE.Line).geometry.setFromPoints(points);
                            }
                        }
                    });
                } else {
                    // 개별 노드 이동 시 관련 엣지만 업데이트
                    const nodeId = draggedNodeRef.userData.id;
                    edgesRef.current.forEach((edge) => {
                        if (edge.userData.source === nodeId || edge.userData.target === nodeId) {
                            const sourceNode = nodesRef.current.get(edge.userData.source);
                            const targetNode = nodesRef.current.get(edge.userData.target);
                            
                            if (sourceNode && targetNode) {
                                const sourcePos = sourceNode.position;
                                const targetPos = targetNode.position;
                                
                                const curve = new THREE.QuadraticBezierCurve3(
                                    sourcePos,
                                    new THREE.Vector3(
                                        (sourcePos.x + targetPos.x) / 2,
                                        Math.max(sourcePos.y, targetPos.y) + 2,
                                        (sourcePos.z + targetPos.z) / 2
                                    ),
                                    targetPos
                                );
                                
                                const points = curve.getPoints(50);
                                (edge as THREE.Line).geometry.setFromPoints(points);
                            }
                        }
                    });
                }
                
            } else if (isDragging) {
                // 카메라 회전 처리
                const deltaMove = {
                    x: event.clientX - previousMousePosition.x,
                    y: event.clientY - previousMousePosition.y
                };
                
                const spherical = new THREE.Spherical();
                spherical.setFromVector3(camera.position);
                spherical.theta -= deltaMove.x * 0.01;
                spherical.phi += deltaMove.y * 0.01;
                spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
                
                camera.position.setFromSpherical(spherical);
                camera.lookAt(0, 0, 0);
                
                previousMousePosition = { x: event.clientX, y: event.clientY };
                
            } else {
                // 호버 처리
                raycasterRef.current.setFromCamera(mouseRef.current, camera);
                const intersects = raycasterRef.current.intersectObjects(Array.from(nodesRef.current.values()));
                
                if (intersects.length > 0) {
                    const nodeData = intersects[0].object.userData;
                    if (nodeData?.info) {
                        setTooltip({
                            visible: true,
                            x: event.clientX + 10,
                            y: event.clientY - 10,
                            content: nodeData.info
                        });
                    }
                    renderer.domElement.style.cursor = 'pointer';
                } else {
                    setTooltip(prev => ({ ...prev, visible: false }));
                    renderer.domElement.style.cursor = 'default';
                }
            }
        };
        
        const handleMouseUp = () => {
            isDragging = false;
            isNodeDragging = false;
            draggedNodeRef = null;
            setDraggedNode(null);
            renderer.domElement.style.cursor = 'default';
        };
        
        const handleWheel = (event: WheelEvent) => {
            event.preventDefault();
            const distance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
            const delta = event.deltaY > 0 ? 1.1 : 0.9;
            const newDistance = Math.max(5, Math.min(50, distance * delta));
            
            camera.position.normalize().multiplyScalar(newDistance);
            setCurrentZoom(50 / newDistance);
            
            // 자동 축소 기능
            if (isAutoCollapse) {
                const shouldCollapse = newDistance > 30;
                if (shouldCollapse !== isCollapsed) {
                    setIsCollapsed(shouldCollapse);
                }
            }
        };
        
        const handleClick = (event: MouseEvent) => {
            // 드래그 중이었다면 클릭 이벤트 무시
            if (event.detail === 1) { // 단일 클릭만 처리
                setTimeout(() => {
                    if (isNodeDragging) return;
                    
                    const rect = renderer.domElement.getBoundingClientRect();
                    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
                    
                    raycasterRef.current.setFromCamera(mouseRef.current, camera);
                    const intersects = raycasterRef.current.intersectObjects(Array.from(nodesRef.current.values()));
                    
                    if (intersects.length > 0) {
                        const nodeData = intersects[0].object.userData;
                        setTooltip(prev => ({ ...prev, visible: false }));
                        
                        // 노드 클릭 시 카메라 포커스
                        if (event.ctrlKey || event.metaKey) {
                            focusOnNode(intersects[0].object.position);
                        } else {
                            // 일반 클릭 - 상세 툴팁 표시
                            setClickTooltip({
                                visible: true,
                                x: event.clientX + 10,
                                y: event.clientY - 10,
                                nodeData: nodeData
                            });
                        }
                    } else {
                        // 배경 클릭 - 그룹 클릭 체크
                        const groupPositions = {
                            'group1': { x: 0, z: 0 },
                            'group2': { x: -8, z: 0 },
                            'group3': { x: 8, z: 0 }
                        };
                        
                        const mousePos3D = getMousePosition3D(event, 0);
                        let clickedGroup = null;
                        
                        Object.entries(groupPositions).forEach(([groupId, position]) => {
                            const distance = Math.sqrt(
                                Math.pow(mousePos3D.x - position.x, 2) + 
                                Math.pow(mousePos3D.z - position.z, 2)
                            );
                            if (distance < 6) { // 그룹 영역 내 클릭
                                clickedGroup = groupId;
                            }
                        });
                        
                        if (clickedGroup) {
                            const groupPos = groupPositions[clickedGroup as keyof typeof groupPositions];
                            focusOnGroup(groupPos);
                        } else {
                            setClickTooltip(prev => ({ ...prev, visible: false }));
                        }
                    }
                }, 100);
            }
        };
        
        // 키보드 이벤트 핸들링
        const handleKeyDown = (event: KeyboardEvent) => {
            console.log('Key down:', event.key, 'Shift:', event.shiftKey);
            if (event.key === 'Shift') {
                setDragMode(true);
                if (!isNodeDragging && !isDragging) {
                    renderer.domElement.style.cursor = 'move';
                }
            }
        };
        
        const handleKeyUp = (event: KeyboardEvent) => {
            console.log('Key up:', event.key, 'Shift:', event.shiftKey);
            if (event.key === 'Shift') {
                setDragMode(false);
                if (!isNodeDragging && !isDragging) {
                    renderer.domElement.style.cursor = 'default';
                }
            }
        };
        
        renderer.domElement.addEventListener('mousedown', handleMouseDown);
        renderer.domElement.addEventListener('mousemove', handleMouseMove);
        renderer.domElement.addEventListener('mouseup', handleMouseUp);
        renderer.domElement.addEventListener('wheel', handleWheel);
        renderer.domElement.addEventListener('click', handleClick);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        // 애니메이션 루프
        const animate = () => {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();
        
        // 윈도우 리사이즈 처리
        const handleResize = () => {
            if (!mountRef.current) return;
            const width = mountRef.current.clientWidth;
            const height = mountRef.current.clientHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };
        
        window.addEventListener('resize', handleResize);
        
        // 클린업
        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
            if (mountRef.current && renderer.domElement.parentNode) {
                mountRef.current.removeChild(renderer.domElement);
            }
            renderer.domElement.removeEventListener('mousedown', handleMouseDown);
            renderer.domElement.removeEventListener('mousemove', handleMouseMove);
            renderer.domElement.removeEventListener('mouseup', handleMouseUp);
            renderer.domElement.removeEventListener('wheel', handleWheel);
            renderer.domElement.removeEventListener('click', handleClick);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('resize', handleResize);
            renderer.dispose();
        };
    }, []);

    // 축소/확장 효과 처리
    useEffect(() => {
        // 노드 표시/숨김 처리
        nodesRef.current.forEach((nodeMesh, nodeId) => {
            const nodeData = nodeMesh.userData;
            if (nodeData.type === 'group') return;
            
            if (isCollapsed && !nodeData.isMainNode) {
                nodeMesh.visible = false;
            } else {
                nodeMesh.visible = true;
            }
        });
        
        // 엣지 표시/숨김 처리
        edgesRef.current.forEach((edge) => {
            const sourceNode = nodesRef.current.get(edge.userData.source);
            const targetNode = nodesRef.current.get(edge.userData.target);
            
            if (sourceNode && targetNode) {
                const sourceVisible = sourceNode.visible;
                const targetVisible = targetNode.visible;
                edge.visible = sourceVisible && targetVisible;
            }
        });
    }, [isCollapsed]);

    return (
        <div style={{ width: '100%', height: '100vh', padding: '20px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ color: '#333', margin: 0 }}>3D 네트워크 토폴로지</h1>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                        줌: {Math.round(currentZoom * 100)}%
                    </div>
                    <button 
                        onClick={() => setIsAutoCollapse(!isAutoCollapse)}
                        style={{
                            padding: '6px 12px',
                            backgroundColor: isAutoCollapse ? '#27ae60' : '#95a5a6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        자동 축소: {isAutoCollapse ? 'ON' : 'OFF'}
                    </button>
                    <button 
                        onClick={() => {
                            setIsAutoCollapse(false);
                            setIsCollapsed(!isCollapsed);
                        }}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: isCollapsed ? '#e74c3c' : '#3498db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            opacity: isAutoCollapse ? 0.6 : 1
                        }}
                        disabled={isAutoCollapse}
                    >
                        {isCollapsed ? '전체 보기' : '축소 보기'}
                    </button>
                </div>
            </div>
            
            <div 
                ref={mountRef} 
                style={{ 
                    width: '100%', 
                    height: '80vh', 
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    backgroundColor: '#f8f9fa',
                    position: 'relative'
                }} 
            />

            {/* 호버 툴팁 */}
            {tooltip.visible && !clickTooltip.visible && (
                <div 
                    style={{
                        position: 'absolute',
                        left: tooltip.x,
                        top: tooltip.y,
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        color: 'white',
                        padding: '10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        whiteSpace: 'pre-line',
                        zIndex: 1000,
                        pointerEvents: 'none',
                        maxWidth: '250px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }}
                >
                    {tooltip.content}
                </div>
            )}

            {/* 클릭 상세 툴팁 */}
            {clickTooltip.visible && clickTooltip.nodeData && (
                <div 
                    style={{
                        position: 'absolute',
                        left: clickTooltip.x,
                        top: clickTooltip.y,
                        backgroundColor: 'white',
                        color: '#333',
                        padding: '16px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        zIndex: 1500,
                        minWidth: '300px',
                        maxWidth: '400px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        border: '1px solid #ddd'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                            {clickTooltip.nodeData.label}
                        </h3>
                        <button 
                            onClick={() => setClickTooltip(prev => ({ ...prev, visible: false }))}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '16px',
                                cursor: 'pointer',
                                color: '#666',
                                padding: '2px'
                            }}
                        >
                            ×
                        </button>
                    </div>

                    <div style={{ marginBottom: '12px', lineHeight: '1.5' }}>
                        <div><strong>타입:</strong> {clickTooltip.nodeData.type}</div>
                        {clickTooltip.nodeData.details?.ip && (
                            <div><strong>IP:</strong> {clickTooltip.nodeData.details.ip}</div>
                        )}
                        {clickTooltip.nodeData.details?.model && (
                            <div><strong>모델:</strong> {clickTooltip.nodeData.details.model}</div>
                        )}
                        {clickTooltip.nodeData.details?.uptime && (
                            <div><strong>가동시간:</strong> {clickTooltip.nodeData.details.uptime}</div>
                        )}
                        {clickTooltip.nodeData.details?.cpu && (
                            <div><strong>CPU:</strong> {clickTooltip.nodeData.details.cpu}</div>
                        )}
                        {clickTooltip.nodeData.details?.memory && (
                            <div><strong>메모리:</strong> {clickTooltip.nodeData.details.memory}</div>
                        )}
                    </div>

                    {clickTooltip.nodeData.details && (
                        <div style={{ borderTop: '1px solid #eee', paddingTop: '12px' }}>
                            <button 
                                onClick={() => {
                                    setSelectedNode(clickTooltip.nodeData);
                                    setIsModalOpen(true);
                                    setClickTooltip(prev => ({ ...prev, visible: false }));
                                }}
                                style={{
                                    width: '100%',
                                    padding: '8px 16px',
                                    backgroundColor: '#3498db',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '500'
                                }}
                            >
                                상세 정보 보기
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* 범례 */}
            <div style={{
                position: 'absolute',
                top: '80px',
                right: '30px',
                backgroundColor: 'white',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                fontSize: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>범례</h4>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                    <div style={{ width: '16px', height: '16px', backgroundColor: '#e74c3c', marginRight: '8px', borderRadius: '2px' }}></div>
                    라우터
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                    <div style={{ width: '16px', height: '16px', backgroundColor: '#3498db', marginRight: '8px' }}></div>
                    스위치
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                    <div style={{ width: '16px', height: '16px', backgroundColor: '#2ecc71', marginRight: '8px', borderRadius: '2px' }}></div>
                    서버
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ width: '16px', height: '16px', backgroundColor: '#f39c12', marginRight: '8px', borderRadius: '50%' }}></div>
                    클라이언트
                </div>
                <div style={{ fontSize: '11px', color: '#666', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                    <strong>기본 조작:</strong><br/>
                    • 노드 드래그: 개별 이동<br/>
                    • Alt+노드 드래그: 그룹 전체 이동<br/>
                    • 빈 공간 드래그: 카메라 회전<br/>
                    • Shift+드래그: 강제 카메라 회전<br/><br/>
                    
                    <strong>클릭 기능:</strong><br/>
                    • 노드 클릭: 상세 정보<br/>
                    • Ctrl+노드 클릭: 카메라 포커스<br/>
                    • 그룹 영역 클릭: 그룹 포커스<br/>
                    • 마우스 휠: 줌 조절
                </div>
            </div>

            {/* 상세 정보 모달 - cytoscape와 동일한 모달 */}
            {isModalOpen && selectedNode && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 2000
                }} onClick={() => setIsModalOpen(false)}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        padding: '24px',
                        maxWidth: '600px',
                        maxHeight: '80vh',
                        overflow: 'auto',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, color: '#333', fontSize: '24px' }}>
                                {selectedNode.details?.name || selectedNode.label}
                            </h2>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: '#666',
                                    padding: '4px'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            {/* 기본 정보 */}
                            <div>
                                <h3 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '16px', borderBottom: '2px solid #3498db', paddingBottom: '5px' }}>기본 정보</h3>
                                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                                    <div><strong>IP 주소:</strong> {selectedNode.details?.ip}</div>
                                    <div><strong>MAC 주소:</strong> {selectedNode.details?.mac}</div>
                                    <div><strong>모델:</strong> {selectedNode.details?.model}</div>
                                    <div><strong>OS:</strong> {selectedNode.details?.os}</div>
                                    <div><strong>위치:</strong> {selectedNode.details?.location}</div>
                                </div>
                            </div>

                            {/* 상태 정보 */}
                            <div>
                                <h3 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '16px', borderBottom: '2px solid #e74c3c', paddingBottom: '5px' }}>상태 정보</h3>
                                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                                    <div><strong>가동 시간:</strong> {selectedNode.details?.uptime}</div>
                                    <div><strong>CPU 사용률:</strong> {selectedNode.details?.cpu}</div>
                                    <div><strong>메모리:</strong> {selectedNode.details?.memory}</div>
                                    <div><strong>온도:</strong> {selectedNode.details?.temperature}</div>
                                    {selectedNode.details?.traffic && <div><strong>트래픽:</strong> {selectedNode.details.traffic}</div>}
                                </div>
                            </div>
                        </div>

                        {/* 포트 정보 (라우터인 경우) */}
                        {selectedNode.details?.ports && (
                            <div style={{ marginTop: '20px' }}>
                                <h3 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '16px', borderBottom: '2px solid #2ecc71', paddingBottom: '5px' }}>포트 상태</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                                    {selectedNode.details.ports.map((port: any, index: number) => (
                                        <div key={index} style={{
                                            padding: '8px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            fontSize: '12px'
                                        }}>
                                            <div><strong>{port.name}</strong></div>
                                            <div>상태: <span style={{ color: port.status === 'up' ? '#27ae60' : '#e74c3c' }}>{port.status}</span></div>
                                            <div>속도: {port.speed}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* VLAN 정보 (스위치인 경우) */}
                        {selectedNode.details?.vlans && (
                            <div style={{ marginTop: '20px' }}>
                                <h3 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '16px', borderBottom: '2px solid #f39c12', paddingBottom: '5px' }}>VLAN 구성</h3>
                                <div style={{ fontSize: '14px' }}>
                                    <div style={{ marginBottom: '10px' }}>
                                        <strong>총 포트:</strong> {selectedNode.details.ports_total} | 
                                        <strong> 활성 포트:</strong> {selectedNode.details.ports_active}
                                    </div>
                                    {selectedNode.details.vlans.map((vlan: any, index: number) => (
                                        <div key={index} style={{
                                            padding: '6px 12px',
                                            margin: '4px 0',
                                            backgroundColor: '#f8f9fa',
                                            borderRadius: '4px',
                                            display: 'flex',
                                            justifyContent: 'space-between'
                                        }}>
                                            <span><strong>VLAN {vlan.id}:</strong> {vlan.name}</span>
                                            <span>{vlan.ports} ports</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 프로토콜 정보 */}
                        {selectedNode.details?.protocols && (
                            <div style={{ marginTop: '20px' }}>
                                <h3 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '16px', borderBottom: '2px solid #9b59b6', paddingBottom: '5px' }}>지원 프로토콜</h3>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {selectedNode.details.protocols.map((protocol: string, index: number) => (
                                        <span key={index} style={{
                                            padding: '4px 8px',
                                            backgroundColor: '#9b59b6',
                                            color: 'white',
                                            borderRadius: '12px',
                                            fontSize: '12px'
                                        }}>
                                            {protocol}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: '24px', textAlign: 'right' }}>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#3498db',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Page;