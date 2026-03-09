import { Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { GlobalOutlined } from '@ant-design/icons'

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

function LanguageSelector() {
  const { i18n } = useTranslation()

  const handleChange = (value: string) => {
    i18n.changeLanguage(value)
  }

  const getCurrentLanguage = () => {
    const lang = i18n.language
    if (lang === 'zh-TW' || lang.startsWith('zh-Hant')) return 'zh-TW'
    if (lang.startsWith('zh')) return 'zh-CN'
    const found = languages.find(l => lang === l.value || lang.startsWith(l.value))
    return found ? found.value : 'en'
  }

  return (
    <Select
      value={getCurrentLanguage()}
      onChange={handleChange}
      options={languages}
      style={{ width: 130 }}
      suffixIcon={<GlobalOutlined />}
      size="small"
    />
  )
}

export default LanguageSelector
