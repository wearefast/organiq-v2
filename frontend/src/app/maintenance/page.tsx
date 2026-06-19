export default function MaintenancePage() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f0f0f',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            color: '#ffffff',
            maxWidth: '480px',
            padding: '0 24px',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: '#1a1a1a',
              border: '1px solid #2a2a2a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 32px',
              fontSize: 28,
            }}
          >
            🔧
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              margin: '0 0 12px',
              letterSpacing: '-0.02em',
            }}
          >
            Under Maintenance
          </h1>
          <p
            style={{
              fontSize: 16,
              color: '#888888',
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            We'll be right back.
          </p>
        </div>
      </body>
    </html>
  );
}
