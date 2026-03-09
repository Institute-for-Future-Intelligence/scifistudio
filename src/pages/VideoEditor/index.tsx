import { Typography, Card } from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'

const { Title, Paragraph } = Typography

function VideoEditor() {
  const { user } = useAuth()
  const { t } = useTranslation()

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Title level={3}>{t('videoEditor.title')}</Title>
        <Paragraph style={{ color: '#999' }}>
          {t('storyEditor.pleaseSignIn')}
        </Paragraph>
      </div>
    )
  }

  return (
    <div>
      <Title level={3}>{t('videoEditor.title')}</Title>
      <Paragraph style={{ color: '#666' }}>
        {t('videoEditor.description')}
      </Paragraph>

      <Card style={{ marginTop: 24 }}>
        <div
          style={{
            minHeight: 300,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 48,
          }}
        >
          <PlayCircleOutlined style={{ fontSize: 64, color: '#ddd', marginBottom: 24 }} />
          <Title level={4} style={{ color: '#999', margin: 0 }}>
            {t('videoEditor.comingSoon')}
          </Title>
          <Paragraph style={{ color: '#999', marginTop: 16, textAlign: 'center', maxWidth: 400 }}>
            {t('videoEditor.placeholder')}
          </Paragraph>
        </div>
      </Card>
    </div>
  )
}

export default VideoEditor
