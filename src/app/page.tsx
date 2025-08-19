"use client";

import Link from "next/link";
import Image from "next/image";
import styles from "./page.module.css";

export default function Home() {
    const versions = [
        {
            id: "cytoscape",
            title: "Cytoscape.js 버전",
            description: "강력한 그래프 시각화 라이브러리를 사용한 네트워크 토폴로지",
            url: "/cyto",
            color: "#3498db",
            features: [
                "풍부한 레이아웃 알고리즘",
                "고성능 대용량 데이터 처리",
                "복잡한 그래프 분석 기능",
                "다양한 익스텐션 지원",
            ],
        },
        {
            id: "threejs",
            title: "Isometric Topology 버전",
            description: "yFiles 스타일의 Isometric Drawing으로 구현한 3D 토폴로지 시각화",
            url: "/three",
            color: "#e74c3c",
            features: [
                "Isometric 투영을 통한 3D 시각화",
                "노드 높이 실시간 조절 (Shift+드래그)",
                "회전 슬라이더로 각도 조정",
                "그리드 토글 및 레이아웃 알고리즘",
                "계층적/직교 자동 레이아웃",
                "인터랙티브 노드 선택 및 생성",
            ],
        },
        {
            id: "vanilla",
            title: "Vanilla JavaScript 버전",
            description: "라이브러리 없이 순수 JavaScript와 Canvas로 직접 구현",
            url: "/vanilla",
            color: "#2ecc71",
            features: [
                "Zero Dependencies",
                "Canvas 2D API 직접 활용",
                "완전한 커스터마이징 가능",
                "최소한의 번들 크기",
            ],
        },
    ];

    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <Image
                    className={styles.logo}
                    src='/next.svg'
                    alt='Next.js logo'
                    width={180}
                    height={38}
                    priority
                />
                <ol>
                    <li>
                        Get started by editing <code>src/app/page.tsx</code>.
                    </li>
                    <li>Save and see your changes instantly.</li>
                </ol>

                <div className={styles.ctas}>
                    <a
                        className={styles.primary}
                        href='https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app'
                        target='_blank'
                        rel='noopener noreferrer'>
                        <Image
                            className={styles.logo}
                            src='/vercel.svg'
                            alt='Vercel logomark'
                            width={20}
                            height={20}
                        />
                        Deploy now
                    </a>
                    <a
                        href='https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app'
                        target='_blank'
                        rel='noopener noreferrer'
                        className={styles.secondary}>
                        Read our docs
                    </a>
                </div>
            </main>
            <footer className={styles.footer}>
                <a
                    href='https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app'
                    target='_blank'
                    rel='noopener noreferrer'>
                    <Image aria-hidden src='/file.svg' alt='File icon' width={16} height={16} />
                    Learn
                </a>
                <a
                    href='https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app'
                    target='_blank'
                    rel='noopener noreferrer'>
                    <Image aria-hidden src='/window.svg' alt='Window icon' width={16} height={16} />
                    Examples
                </a>
                <a
                    href='https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app'
                    target='_blank'
                    rel='noopener noreferrer'>
                    <Image aria-hidden src='/globe.svg' alt='Globe icon' width={16} height={16} />
                    Go to nextjs.org →
                </a>
            </footer>
        </div>
    );
}
