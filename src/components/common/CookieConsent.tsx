import { useState, useEffect } from 'react'
import { Button, Space } from 'antd'

function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent')
    if (!consent) {
      setVisible(true)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted')
    setVisible(false)
  }

  const handleDecline = () => {
    localStorage.setItem('cookie-consent', 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#1f1f1f',
        color: '#fff',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        zIndex: 1000,
        boxShadow: '0 -2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ flex: 1, minWidth: 300 }}>
        <p style={{ margin: 0, fontSize: 14 }}>
          We use cookies to enhance your experience. By continuing to use this site, you agree to our use of cookies.
        </p>
      </div>
      <Space>
        <Button onClick={handleDecline}>
          Decline
        </Button>
        <Button type="primary" onClick={handleAccept}>
          Accept
        </Button>
      </Space>
    </div>
  )
}

export default CookieConsent
