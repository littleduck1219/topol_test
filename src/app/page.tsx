
'use client';

import Link from 'next/link';

export default function Home() {
    const versions = [
        {
            id: 'cytoscape',
            title: 'Cytoscape.js 버전',
            description: '강력한 그래프 시각화 라이브러리를 사용한 네트워크 토폴로지',
            url: '/cyto',
            color: '#3498db',
            features: [
                '풍부한 레이아웃 알고리즘',
                '고성능 대용량 데이터 처리',
                '복잡한 그래프 분석 기능',
                '다양한 익스텐션 지원'
            ]
        },
        {
            id: 'threejs',
            title: 'Three.js 버전',
            description: '3D 웹 그래픽 라이브러리로 구현한 입체적 네트워크 시각화',
            url: '/three',
            color: '#e74c3c',
            features: [
                '3D 공간에서의 네트워크 표현',
                '카메라 회전 및 줌 제어',
                '입체적 노드와 곡선 연결선',
                'WebGL 기반 고성능 렌더링'
            ]
        },
        {
            id: 'vanilla',
            title: 'Vanilla JavaScript 버전',
            description: '라이브러리 없이 순수 JavaScript와 Canvas로 직접 구현',
            url: '/vanilla',
            color: '#2ecc71',
            features: [
                'Zero Dependencies',
                'Canvas 2D API 직접 활용',
                '완전한 커스터마이징 가능',
                '최소한의 번들 크기'
            ]
        }
    ];

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '40px 20px'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* 헤더 */}
                <header style={{ textAlign: 'center', marginBottom: '60px' }}>
                    <h1 style={{ 
                        color: 'white', 
                        fontSize: '3rem', 
                        margin: '0 0 20px 0',
                        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}>
                        네트워크 토폴로지 시각화
                    </h1>
                    <p style={{ 
                        color: 'rgba(255,255,255,0.9)', 
                        fontSize: '1.2rem', 
                        margin: 0,
                        textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                    }}>
                        다양한 기술로 구현한 3가지 버전을 비교해보세요
                    </p>
                </header>

                {/* 버전 카드들 */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
                    gap: '30px',
                    marginBottom: '40px'
                }}>
                    {versions.map((version) => (
                        <div key={version.id} style={{
                            backgroundColor: 'white',
                            borderRadius: '16px',
                            padding: '30px',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                            cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-5px)';
                            e.currentTarget.style.boxShadow = '0 15px 40px rgba(0,0,0,0.25)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
                        }}>
                            {/* 카드 헤더 */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{
                                    width: '60px',
                                    height: '4px',
                                    backgroundColor: version.color,
                                    borderRadius: '2px',
                                    marginBottom: '15px'
                                }}></div>
                                <h2 style={{ 
                                    color: '#333', 
                                    fontSize: '1.5rem', 
                                    margin: '0 0 10px 0' 
                                }}>
                                    {version.title}
                                </h2>
                                <p style={{ 
                                    color: '#666', 
                                    lineHeight: '1.6', 
                                    margin: 0 
                                }}>
                                    {version.description}
                                </p>
                            </div>

                            {/* 기능 목록 */}
                            <div style={{ marginBottom: '25px' }}>
                                <h4 style={{ 
                                    color: '#333', 
                                    fontSize: '1rem', 
                                    margin: '0 0 12px 0' 
                                }}>
                                    주요 특징:
                                </h4>
                                <ul style={{ 
                                    margin: 0, 
                                    paddingLeft: '20px',
                                    color: '#666',
                                    lineHeight: '1.8'
                                }}>
                                    {version.features.map((feature, index) => (
                                        <li key={index} style={{ marginBottom: '4px' }}>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* 버튼 */}
                            <Link href={version.url} style={{ textDecoration: 'none' }}>
                                <button style={{
                                    width: '100%',
                                    padding: '12px 24px',
                                    backgroundColor: version.color,
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.02)';
                                    e.currentTarget.style.opacity = '0.9';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.opacity = '1';
                                }}>
                                    {version.title} 체험하기 →
                                </button>
                            </Link>
                        </div>
                    ))}
                </div>

                {/* 비교 테이블 */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '30px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                }}>
                    <h3 style={{ 
                        color: '#333', 
                        fontSize: '1.5rem', 
                        margin: '0 0 25px 0',
                        textAlign: 'center'
                    }}>
                        기술별 비교
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ 
                            width: '100%', 
                            borderCollapse: 'collapse',
                            fontSize: '0.9rem'
                        }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #eee' }}>
                                    <th style={{ padding: '12px', textAlign: 'left', color: '#333' }}>특징</th>
                                    <th style={{ padding: '12px', textAlign: 'center', color: '#3498db' }}>Cytoscape.js</th>
                                    <th style={{ padding: '12px', textAlign: 'center', color: '#e74c3c' }}>Three.js</th>
                                    <th style={{ padding: '12px', textAlign: 'center', color: '#2ecc71' }}>Vanilla JS</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '12px', fontWeight: '500' }}>번들 크기</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>📦 중간</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>📦 큼</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>🪶 최소</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '12px', fontWeight: '500' }}>개발 난이도</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>⭐⭐</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>⭐⭐⭐</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>⭐⭐⭐⭐</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '12px', fontWeight: '500' }}>커스터마이징</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>🔧 높음</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>🔧 매우 높음</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>🔧 완전</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '12px', fontWeight: '500' }}>성능</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>🚀 우수</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>🚀 매우 우수</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>🚀 최적화됨</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '12px', fontWeight: '500' }}>학습 가치</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>📚 API 활용</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>📚 3D 그래픽</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>📚 원리 이해</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 푸터 */}
                <footer style={{ 
                    textAlign: 'center', 
                    marginTop: '40px',
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: '0.9rem'
                }}>
                    각 버전을 직접 체험해보고 차이점을 확인해보세요! 🚀
                </footer>
            </div>
        </div>
    );
}
