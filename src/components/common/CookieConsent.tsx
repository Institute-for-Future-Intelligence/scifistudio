import { useState, useEffect } from 'react'
import { Button, Space } from 'antd'
import { useTranslation } from 'react-i18next'

function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const { t } = useTranslation()

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
          {t('cookie.message')}
        </p>
      </div>
      <Space>
        <Button onClick={handleDecline}>
          {t('cookie.decline')}
        </Button>
        <Button type="primary" onClick={handleAccept}>
          {t('cookie.accept')}
        </Button>
      </Space>
    </div>
  )
}

export default CookieConsent
