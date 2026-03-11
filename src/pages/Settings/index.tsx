/*
 * Copyright 2026 Institute for Future Intelligence, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { Typography, Card, Select, Avatar, Descriptions, Button, message } from 'antd'
import { UserOutlined, GoogleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'

const { Title } = Typography

const languages = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
  { value: 'el', label: 'Ελληνικά' },
  { value: 'ru', label: 'Русский' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'ar', label: 'العربية' },
  { value: 'fa', label: 'فارسی' },
  { value: 'th', label: 'ไทย' },
  { value: 'id', label: 'Indonesia' },
  { value: 'uk', label: 'Українська' },
]

function Settings() {
  const { t, i18n } = useTranslation()
  const { user, signIn, signOut } = useAuth()

  const getCurrentLanguage = () => {
    const lang = i18n.language
    if (lang === 'zh-TW' || lang.startsWith('zh-Hant')) return 'zh-TW'
    if (lang.startsWith('zh')) return 'zh-CN'
    const found = languages.find(l => lang === l.value || lang.startsWith(l.value))
    return found ? found.value : 'en'
  }

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value)
    message.success(t('settings.languageChanged'))
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={2}>{t('settings.title')}</Title>

      <Card title={t('settings.account')} style={{ marginBottom: 24 }}>
        {user ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <Avatar
                size={64}
                src={user.photoURL}
                icon={!user.photoURL && <UserOutlined />}
              />
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  {user.displayName || (user.isAnonymous ? t('auth.guest') : t('settings.unnamed'))}
                </div>
                <div style={{ color: '#999' }}>{user.email}</div>
              </div>
            </div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label={t('settings.userId')}>{user.uid}</Descriptions.Item>
              <Descriptions.Item label={t('settings.provider')}>
                {user.isAnonymous ? t('auth.guest') : 'Google'}
              </Descriptions.Item>
            </Descriptions>
            <Button
              style={{ marginTop: 16 }}
              onClick={signOut}
            >
              {t('auth.signOut')}
            </Button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ marginBottom: 16 }}>{t('settings.notSignedIn')}</p>
            <Button type="primary" icon={<GoogleOutlined />} onClick={signIn}>
              {t('auth.signInWithGoogle')}
            </Button>
          </div>
        )}
      </Card>

      <Card title={t('settings.language')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span>{t('settings.selectLanguage')}</span>
          <Select
            value={getCurrentLanguage()}
            onChange={handleLanguageChange}
            options={languages}
            style={{ width: 200 }}
          />
        </div>
      </Card>
    </div>
  )
}

export default Settings
