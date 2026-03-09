import { useState, useRef, useEffect } from 'react'
import { Tag, Input, Spin } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

interface TagEditorProps {
  tags: string[]
  onChange?: (tags: string[]) => void
  loading?: boolean
  editable?: boolean
  maxTags?: number
}

function TagEditor({ tags, onChange, loading = false, editable = true, maxTags = 10 }: TagEditorProps) {
  const { t } = useTranslation()
  const [inputVisible, setInputVisible] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputVisible && inputRef.current) {
      inputRef.current.focus()
    }
  }, [inputVisible])

  const handleClose = (removedTag: string) => {
    if (!editable || !onChange) return
    const newTags = tags.filter(tag => tag !== removedTag)
    onChange(newTags)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleInputConfirm = () => {
    const trimmedValue = inputValue.trim().toLowerCase()
    if (trimmedValue && !tags.includes(trimmedValue) && tags.length < maxTags && onChange) {
      onChange([...tags, trimmedValue])
    }
    setInputVisible(false)
    setInputValue('')
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputConfirm()
    } else if (e.key === 'Escape') {
      setInputVisible(false)
      setInputValue('')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Spin size="small" />
        <span style={{ color: '#666', fontSize: 14 }}>{t('tags.generating')}</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {tags.map(tag => (
        <Tag
          key={tag}
          color="blue"
          closable={editable}
          onClose={() => handleClose(tag)}
          style={{ margin: 0 }}
        >
          {tag}
        </Tag>
      ))}
      {editable && tags.length < maxTags && (
        inputVisible ? (
          <Input
            ref={inputRef as any}
            type="text"
            size="small"
            style={{ width: 100 }}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputConfirm}
            onKeyDown={handleInputKeyDown}
            placeholder={t('tags.newTag')}
          />
        ) : (
          <Tag
            style={{ cursor: 'pointer', borderStyle: 'dashed' }}
            onClick={() => setInputVisible(true)}
          >
            <PlusOutlined /> {t('tags.addTag')}
          </Tag>
        )
      )}
    </div>
  )
}

export default TagEditor
