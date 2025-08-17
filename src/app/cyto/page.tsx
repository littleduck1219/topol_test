"use client";

import React, { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";

function Page() {
    const cyRef = useRef<HTMLDivElement>(null);
    const cyInstanceRef = useRef<cytoscape.Core | null>(null);
    const [tooltip, setTooltip] = useState<{
        visible: boolean;
        x: number;
        y: number;
        content: string;
    }>({
        visible: false,
        x: 0,
        y: 0,
        content: "",
    });
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [currentZoom, setCurrentZoom] = useState(1);
    const [isAutoCollapse, setIsAutoCollapse] = useState(true);
    const [selectedNode, setSelectedNode] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [clickTooltip, setClickTooltip] = useState<{
        visible: boolean;
        x: number;
        y: number;
        nodeData: any;
    }>({
        visible: false,
        x: 0,
        y: 0,
        nodeData: null,
    });

    // Cytoscape 초기화
    useEffect(() => {
        if (!cyRef.current) return;

        const cy = cytoscape({
            container: cyRef.current,
            elements: [
                // 그룹 노드들 (compound nodes)
                {
                    data: {
                        id: "group1",
                        label: "Core Network",
                        type: "group",
                        info: "Core network infrastructure containing main routers",
                    },
                },
                {
                    data: {
                        id: "group2",
                        label: "Branch A",
                        type: "group",
                        info: "Branch A network segment with local services",
                    },
                },
                {
                    data: {
                        id: "group3",
                        label: "Branch B",
                        type: "group",
                        info: "Branch B network segment with client devices",
                    },
                },

                // 노드들 (그룹에 속함)
                {
                    data: {
                        id: "router1",
                        label: "Router 1",
                        parent: "group1",
                        type: "router",
                        info: "Main core router - 10.0.0.1\nUptime: 99.9%\nTraffic: 1.2 Gbps",
                        isMainNode: true,
                        details: {
                            name: "Core Router 1",
                            ip: "10.0.0.1",
                            mac: "00:1B:44:11:3A:B7",
                            model: "Cisco ISR 4431",
                            os: "Cisco IOS XE 16.12",
                            uptime: "365 days, 12 hours",
                            traffic: "1.2 Gbps",
                            cpu: "15%",
                            memory: "2.1GB / 4GB",
                            temperature: "45°C",
                            ports: [
                                { name: "GigabitEthernet0/0/0", status: "up", speed: "1Gbps" },
                                { name: "GigabitEthernet0/0/1", status: "up", speed: "1Gbps" },
                                { name: "GigabitEthernet0/0/2", status: "down", speed: "1Gbps" },
                            ],
                            protocols: ["OSPF", "BGP", "HSRP"],
                            location: "Data Center A - Rack 1",
                        },
                    },
                },
                {
                    data: {
                        id: "router2",
                        label: "Router 2",
                        parent: "group1",
                        type: "router",
                        info: "Secondary core router - 10.0.0.2\nUptime: 99.8%\nTraffic: 800 Mbps",
                        isMainNode: false,
                    },
                },
                {
                    data: {
                        id: "router3",
                        label: "Router 3",
                        parent: "group1",
                        type: "router",
                        info: "Backup core router - 10.0.0.3\nUptime: 99.7%\nTraffic: 200 Mbps",
                        isMainNode: false,
                    },
                },
                {
                    data: {
                        id: "switch1",
                        label: "Switch 1",
                        parent: "group2",
                        type: "switch",
                        info: "Branch A switch - 10.1.0.1\nPorts: 24\nVLANs: 5",
                        isMainNode: true,
                        details: {
                            name: "Branch A Switch",
                            ip: "10.1.0.1",
                            mac: "00:1B:44:22:5C:D8",
                            model: "Cisco Catalyst 2960-X",
                            os: "Cisco IOS 15.2(7)E",
                            uptime: "180 days, 8 hours",
                            ports_total: 24,
                            ports_active: 18,
                            vlans: [
                                { id: 1, name: "default", ports: 10 },
                                { id: 10, name: "servers", ports: 4 },
                                { id: 20, name: "clients", ports: 8 },
                            ],
                            cpu: "8%",
                            memory: "128MB / 256MB",
                            temperature: "38°C",
                            spanning_tree: "RSTP",
                            location: "Building A - Floor 2",
                        },
                    },
                },
                {
                    data: {
                        id: "server1",
                        label: "Server 1",
                        parent: "group2",
                        type: "server",
                        info: "File server - 10.1.0.10\nOS: Ubuntu 22.04\nCPU: 85%\nRAM: 12GB/16GB",
                        isMainNode: false,
                    },
                },
                {
                    data: {
                        id: "client1",
                        label: "Client 1",
                        parent: "group2",
                        type: "client",
                        info: "Workstation 1 - 10.1.0.101\nOS: Windows 11\nUser: Alice",
                        isMainNode: false,
                    },
                },
                {
                    data: {
                        id: "client2",
                        label: "Client 2",
                        parent: "group2",
                        type: "client",
                        info: "Workstation 2 - 10.1.0.102\nOS: Windows 11\nUser: Bob",
                        isMainNode: false,
                    },
                },
                {
                    data: {
                        id: "switch2",
                        label: "Switch 2",
                        parent: "group3",
                        type: "switch",
                        info: "Branch B switch - 10.2.0.1\nPorts: 16\nVLANs: 3",
                        isMainNode: true,
                    },
                },
                {
                    data: {
                        id: "server2",
                        label: "Server 2",
                        parent: "group3",
                        type: "server",
                        info: "Web server - 10.2.0.10\nOS: CentOS 8\nCPU: 45%\nRAM: 8GB/16GB",
                        isMainNode: false,
                    },
                },
                {
                    data: {
                        id: "client3",
                        label: "Client 3",
                        parent: "group3",
                        type: "client",
                        info: "Laptop - 10.2.0.101\nOS: macOS\nUser: Charlie",
                        isMainNode: false,
                    },
                },

                // 엣지들 (연결)
                { data: { id: "e1", source: "router1", target: "router2" } },
                { data: { id: "e2", source: "router2", target: "router3" } },
                { data: { id: "e3", source: "router1", target: "switch1" } },
                { data: { id: "e4", source: "router2", target: "switch2" } },
                { data: { id: "e5", source: "switch1", target: "server1" } },
                { data: { id: "e6", source: "switch2", target: "server2" } },
                { data: { id: "e7", source: "switch1", target: "client1" } },
                { data: { id: "e8", source: "switch1", target: "client2" } },
                { data: { id: "e9", source: "switch2", target: "client3" } },
            ],
            style: [
                // 그룹 스타일
                {
                    selector: "$node > node",
                    style: {
                        "background-color": "#666",
                        label: "data(label)",
                        color: "#fff",
                        "text-valign": "center",
                        "text-halign": "center",
                        "font-size": "12px",
                        width: "60px",
                        height: "60px",
                        "border-width": 2,
                        "border-color": "#333",
                    },
                },
                {
                    selector: ":parent",
                    style: {
                        "background-opacity": 0.2,
                        "background-color": "#ddd",
                        "border-width": 2,
                        "border-color": "#999",
                        "border-style": "dashed",
                        label: "data(label)",
                        "text-valign": "top",
                        "text-halign": "center",
                        "font-size": "14px",
                        "font-weight": "bold",
                        color: "#333",
                        "text-margin-y": 10,
                    },
                },
                // 노드 타입별 스타일
                {
                    selector: 'node[type="router"]',
                    style: {
                        "background-color": "#e74c3c",
                        shape: "round-rectangle",
                    },
                },
                {
                    selector: 'node[type="switch"]',
                    style: {
                        "background-color": "#3498db",
                        shape: "rectangle",
                    },
                },
                {
                    selector: 'node[type="server"]',
                    style: {
                        "background-color": "#2ecc71",
                        shape: "round-rectangle",
                    },
                },
                {
                    selector: 'node[type="client"]',
                    style: {
                        "background-color": "#f39c12",
                        shape: "ellipse",
                    },
                },
                // 메인 노드 스타일 (축소시 보이는 노드)
                {
                    selector: 'node[isMainNode="true"]',
                    style: {
                        "border-width": 4,
                        "border-color": "#fff",
                        "border-style": "solid",
                    },
                },
                // 숨겨진 노드 스타일
                {
                    selector: ".collapsed",
                    style: {
                        display: "none",
                    },
                },
                // 엣지 스타일
                {
                    selector: "edge",
                    style: {
                        width: 3,
                        "line-color": "#ccc",
                        "target-arrow-color": "#ccc",
                        "target-arrow-shape": "triangle",
                        "curve-style": "bezier",
                    },
                },
                // 선택된 요소 스타일
                {
                    selector: ":selected",
                    style: {
                        "background-color": "#9b59b6",
                        "line-color": "#9b59b6",
                        "target-arrow-color": "#9b59b6",
                    },
                },
            ],
            layout: {
                name: "cose",
                idealEdgeLength: 100,
                nodeOverlap: 20,
                refresh: 20,
                fit: true,
                padding: 30,
                randomize: false,
                componentSpacing: 100,
                nodeRepulsion: 400000,
                edgeElasticity: 100,
                nestingFactor: 5,
                gravity: 80,
                numIter: 1000,
                initialTemp: 200,
                coolingFactor: 0.95,
                minTemp: 1.0,
            },
        });

        cyInstanceRef.current = cy;

        // 노드 호버 이벤트 (정보 팝업)
        cy.on("mouseover", "node", function (evt) {
            const node = evt.target;
            const nodeInfo = node.data("info");
            if (nodeInfo) {
                const renderedPosition = node.renderedPosition();
                setTooltip({
                    visible: true,
                    x: renderedPosition.x + 70,
                    y: renderedPosition.y - 20,
                    content: nodeInfo,
                });
            }
        });

        cy.on("mouseout", "node", function (evt) {
            setTooltip((prev) => ({ ...prev, visible: false }));
        });

        // 노드 클릭 이벤트
        cy.on("tap", "node", function (evt) {
            const node = evt.target;
            const nodeData = node.data();
            const renderedPosition = node.renderedPosition();

            // 호버 툴팁 숨기기
            setTooltip((prev) => ({ ...prev, visible: false }));

            // 클릭 툴팁 표시
            setClickTooltip({
                visible: true,
                x: renderedPosition.x + 70,
                y: renderedPosition.y - 50,
                nodeData: nodeData,
            });

            console.log("Clicked node:", node.id());
        });

        // 엣지 클릭 이벤트
        cy.on("tap", "edge", function (evt) {
            const edge = evt.target;
            console.log("Clicked edge:", edge.id());
        });

        // 배경 클릭 시 클릭 툴팁 숨기기
        cy.on("tap", function (evt) {
            if (evt.target === cy) {
                setClickTooltip((prev) => ({ ...prev, visible: false }));
            }
        });

        return () => {
            cy.destroy();
            cyInstanceRef.current = null;
        };
    }, []);

    // 줌 레벨 감지 및 자동 축소 처리
    useEffect(() => {
        if (!cyInstanceRef.current) return;

        const cy = cyInstanceRef.current;

        const handleZoom = () => {
            const zoom = cy.zoom();
            setCurrentZoom(zoom);

            if (isAutoCollapse) {
                const zoomThreshold = 0.7;
                const shouldCollapse = zoom < zoomThreshold;

                // 직접 노드 처리 (상태 업데이트 루프 방지)
                if (shouldCollapse) {
                    cy.nodes().forEach((node) => {
                        if (!node.data("isMainNode") && !node.isParent()) {
                            node.addClass("collapsed");
                        } else {
                            node.removeClass("collapsed");
                        }
                    });
                } else {
                    cy.nodes().removeClass("collapsed");
                }

                // 상태는 마지막에 한 번만 업데이트
                setIsCollapsed(shouldCollapse);
            }
        };

        cy.on("zoom", handleZoom);

        return () => {
            cy.off("zoom", handleZoom);
        };
    }, [isAutoCollapse]);

    // 수동 축소/확장 처리
    useEffect(() => {
        if (!cyInstanceRef.current || isAutoCollapse) return;

        const cy = cyInstanceRef.current;

        if (isCollapsed) {
            cy.nodes().forEach((node) => {
                if (!node.data("isMainNode") && !node.isParent()) {
                    node.addClass("collapsed");
                } else {
                    node.removeClass("collapsed");
                }
            });
        } else {
            cy.nodes().removeClass("collapsed");
        }
    }, [isCollapsed, isAutoCollapse]);

    const toggleCollapse = () => {
        setIsAutoCollapse(false);
        setIsCollapsed(!isCollapsed);
    };

    const toggleAutoCollapse = () => {
        const newAutoCollapse = !isAutoCollapse;
        setIsAutoCollapse(newAutoCollapse);

        if (newAutoCollapse && cyInstanceRef.current) {
            // 자동 모드로 전환 시 현재 줌에 따라 상태 설정
            const zoom = cyInstanceRef.current.zoom();
            const zoomThreshold = 0.7;
            setIsCollapsed(zoom < zoomThreshold);
        }
    };

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
                        onClick={toggleAutoCollapse}
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
                        onClick={toggleCollapse}
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

            <div
                ref={cyRef}
                style={{
                    width: "100%",
                    height: "80vh",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    backgroundColor: "#f8f9fa",
                    position: "relative",
                }}
            />

            {/* 호버 정보 팝업 툴팁 */}
            {tooltip.visible && !clickTooltip.visible && (
                <div
                    style={{
                        position: "absolute",
                        left: tooltip.x,
                        top: tooltip.y,
                        backgroundColor: "rgba(0, 0, 0, 0.9)",
                        color: "white",
                        padding: "10px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        whiteSpace: "pre-line",
                        zIndex: 1000,
                        pointerEvents: "none",
                        maxWidth: "250px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    }}>
                    {tooltip.content}
                </div>
            )}

            {/* 클릭 상세 툴팁 */}
            {clickTooltip.visible && clickTooltip.nodeData && (
                <div
                    style={{
                        position: "absolute",
                        left: clickTooltip.x,
                        top: clickTooltip.y,
                        backgroundColor: "white",
                        color: "#333",
                        padding: "16px",
                        borderRadius: "8px",
                        fontSize: "13px",
                        zIndex: 1500,
                        minWidth: "300px",
                        maxWidth: "400px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        border: "1px solid #ddd",
                    }}>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "12px",
                        }}>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>
                            {clickTooltip.nodeData.label}
                        </h3>
                        <button
                            onClick={() => setClickTooltip((prev) => ({ ...prev, visible: false }))}
                            style={{
                                background: "none",
                                border: "none",
                                fontSize: "16px",
                                cursor: "pointer",
                                color: "#666",
                                padding: "2px",
                            }}>
                            ×
                        </button>
                    </div>

                    <div style={{ marginBottom: "12px", lineHeight: "1.5" }}>
                        <div>
                            <strong>타입:</strong> {clickTooltip.nodeData.type}
                        </div>
                        {clickTooltip.nodeData.details?.ip && (
                            <div>
                                <strong>IP:</strong> {clickTooltip.nodeData.details.ip}
                            </div>
                        )}
                        {clickTooltip.nodeData.details?.model && (
                            <div>
                                <strong>모델:</strong> {clickTooltip.nodeData.details.model}
                            </div>
                        )}
                        {clickTooltip.nodeData.details?.uptime && (
                            <div>
                                <strong>가동시간:</strong> {clickTooltip.nodeData.details.uptime}
                            </div>
                        )}
                        {clickTooltip.nodeData.details?.cpu && (
                            <div>
                                <strong>CPU:</strong> {clickTooltip.nodeData.details.cpu}
                            </div>
                        )}
                        {clickTooltip.nodeData.details?.memory && (
                            <div>
                                <strong>메모리:</strong> {clickTooltip.nodeData.details.memory}
                            </div>
                        )}
                    </div>

                    {clickTooltip.nodeData.details && (
                        <div style={{ borderTop: "1px solid #eee", paddingTop: "12px" }}>
                            <button
                                onClick={() => {
                                    setSelectedNode(clickTooltip.nodeData);
                                    setIsModalOpen(true);
                                    setClickTooltip((prev) => ({ ...prev, visible: false }));
                                }}
                                style={{
                                    width: "100%",
                                    padding: "8px 16px",
                                    backgroundColor: "#3498db",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "13px",
                                    fontWeight: "500",
                                }}>
                                상세 정보 보기
                            </button>
                        </div>
                    )}
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
                <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>범례</h4>
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
                <div
                    style={{
                        fontSize: "11px",
                        color: "#666",
                        borderTop: "1px solid #eee",
                        paddingTop: "8px",
                    }}>
                    • 흰색 테두리: 메인 노드
                    <br />
                    • 점선 박스: 그룹
                    <br />
                    • 마우스 오버: 간단 정보
                    <br />
                    • 노드 클릭: 상세 툴팁
                    <br />• 마우스 휠: 줌 및 자동 축소
                </div>
            </div>

            {/* 상세 정보 모달 */}
            {isModalOpen && selectedNode && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 2000,
                    }}
                    onClick={() => setIsModalOpen(false)}>
                    <div
                        style={{
                            backgroundColor: "white",
                            borderRadius: "12px",
                            padding: "24px",
                            maxWidth: "600px",
                            maxHeight: "80vh",
                            overflow: "auto",
                            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
                        }}
                        onClick={(e) => e.stopPropagation()}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "20px",
                            }}>
                            <h2 style={{ margin: 0, color: "#333", fontSize: "24px" }}>
                                {selectedNode.details?.name || selectedNode.label}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    fontSize: "24px",
                                    cursor: "pointer",
                                    color: "#666",
                                    padding: "4px",
                                }}>
                                ×
                            </button>
                        </div>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "20px",
                            }}>
                            {/* 기본 정보 */}
                            <div>
                                <h3
                                    style={{
                                        margin: "0 0 10px 0",
                                        color: "#333",
                                        fontSize: "16px",
                                        borderBottom: "2px solid #3498db",
                                        paddingBottom: "5px",
                                    }}>
                                    기본 정보
                                </h3>
                                <div style={{ fontSize: "14px", lineHeight: "1.6" }}>
                                    <div>
                                        <strong>IP 주소:</strong> {selectedNode.details?.ip}
                                    </div>
                                    <div>
                                        <strong>MAC 주소:</strong> {selectedNode.details?.mac}
                                    </div>
                                    <div>
                                        <strong>모델:</strong> {selectedNode.details?.model}
                                    </div>
                                    <div>
                                        <strong>OS:</strong> {selectedNode.details?.os}
                                    </div>
                                    <div>
                                        <strong>위치:</strong> {selectedNode.details?.location}
                                    </div>
                                </div>
                            </div>

                            {/* 상태 정보 */}
                            <div>
                                <h3
                                    style={{
                                        margin: "0 0 10px 0",
                                        color: "#333",
                                        fontSize: "16px",
                                        borderBottom: "2px solid #e74c3c",
                                        paddingBottom: "5px",
                                    }}>
                                    상태 정보
                                </h3>
                                <div style={{ fontSize: "14px", lineHeight: "1.6" }}>
                                    <div>
                                        <strong>가동 시간:</strong> {selectedNode.details?.uptime}
                                    </div>
                                    <div>
                                        <strong>CPU 사용률:</strong> {selectedNode.details?.cpu}
                                    </div>
                                    <div>
                                        <strong>메모리:</strong> {selectedNode.details?.memory}
                                    </div>
                                    <div>
                                        <strong>온도:</strong> {selectedNode.details?.temperature}
                                    </div>
                                    {selectedNode.details?.traffic && (
                                        <div>
                                            <strong>트래픽:</strong> {selectedNode.details.traffic}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 포트 정보 (라우터인 경우) */}
                        {selectedNode.details?.ports && (
                            <div style={{ marginTop: "20px" }}>
                                <h3
                                    style={{
                                        margin: "0 0 10px 0",
                                        color: "#333",
                                        fontSize: "16px",
                                        borderBottom: "2px solid #2ecc71",
                                        paddingBottom: "5px",
                                    }}>
                                    포트 상태
                                </h3>
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                        gap: "10px",
                                    }}>
                                    {selectedNode.details.ports.map((port: any, index: number) => (
                                        <div
                                            key={index}
                                            style={{
                                                padding: "8px",
                                                border: "1px solid #ddd",
                                                borderRadius: "4px",
                                                fontSize: "12px",
                                            }}>
                                            <div>
                                                <strong>{port.name}</strong>
                                            </div>
                                            <div>
                                                상태:{" "}
                                                <span
                                                    style={{
                                                        color:
                                                            port.status === "up"
                                                                ? "#27ae60"
                                                                : "#e74c3c",
                                                    }}>
                                                    {port.status}
                                                </span>
                                            </div>
                                            <div>속도: {port.speed}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* VLAN 정보 (스위치인 경우) */}
                        {selectedNode.details?.vlans && (
                            <div style={{ marginTop: "20px" }}>
                                <h3
                                    style={{
                                        margin: "0 0 10px 0",
                                        color: "#333",
                                        fontSize: "16px",
                                        borderBottom: "2px solid #f39c12",
                                        paddingBottom: "5px",
                                    }}>
                                    VLAN 구성
                                </h3>
                                <div style={{ fontSize: "14px" }}>
                                    <div style={{ marginBottom: "10px" }}>
                                        <strong>총 포트:</strong> {selectedNode.details.ports_total}{" "}
                                        |<strong> 활성 포트:</strong>{" "}
                                        {selectedNode.details.ports_active}
                                    </div>
                                    {selectedNode.details.vlans.map((vlan: any, index: number) => (
                                        <div
                                            key={index}
                                            style={{
                                                padding: "6px 12px",
                                                margin: "4px 0",
                                                backgroundColor: "#f8f9fa",
                                                borderRadius: "4px",
                                                display: "flex",
                                                justifyContent: "space-between",
                                            }}>
                                            <span>
                                                <strong>VLAN {vlan.id}:</strong> {vlan.name}
                                            </span>
                                            <span>{vlan.ports} ports</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 프로토콜 정보 */}
                        {selectedNode.details?.protocols && (
                            <div style={{ marginTop: "20px" }}>
                                <h3
                                    style={{
                                        margin: "0 0 10px 0",
                                        color: "#333",
                                        fontSize: "16px",
                                        borderBottom: "2px solid #9b59b6",
                                        paddingBottom: "5px",
                                    }}>
                                    지원 프로토콜
                                </h3>
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    {selectedNode.details.protocols.map(
                                        (protocol: string, index: number) => (
                                            <span
                                                key={index}
                                                style={{
                                                    padding: "4px 8px",
                                                    backgroundColor: "#9b59b6",
                                                    color: "white",
                                                    borderRadius: "12px",
                                                    fontSize: "12px",
                                                }}>
                                                {protocol}
                                            </span>
                                        )
                                    )}
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: "24px", textAlign: "right" }}>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                style={{
                                    padding: "8px 16px",
                                    backgroundColor: "#3498db",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                }}>
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
