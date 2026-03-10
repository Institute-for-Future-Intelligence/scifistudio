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
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Typography, Card, Button, Spin, Image, Rate, message, Space, Tag, Select } from 'antd'
import { LeftOutlined, RightOutlined, BookOutlined, HomeOutlined, UserOutlined, ShareAltOutlined, SoundOutlined, PauseCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { getStorybook, rateStorybook, Storybook } from '../../services/firestore'
import { StoryFrame } from '../../services/gemini'
import LanguageSelector from '../../components/common/LanguageSelector'

const { Title, Paragraph, Text } = Typography

// Language code mapping for TTS
const languageCodeMap: Record<string, string> = {
  'en': 'en-US',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  'ja': 'ja-JP',
  'ko': 'ko-KR',
  'de': 'de-DE',
  'es': 'es-ES',
  'fr': 'fr-FR',
  'it': 'it-IT',
  'pt': 'pt-BR',
  'ru': 'ru-RU',
  'ar': 'ar-XA',
  'el': 'el-GR',
  'fa': 'fa-IR',
  'id': 'id-ID',
  'th': 'th-TH',
  'tr': 'tr-TR',
  'uk': 'uk-UA',
}

// Detect language from text content by script analysis
const detectLanguageFromText = (text: string): string => {
  // Count characters by script
  const cjkRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/g
  const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff]/g
  const koreanRegex = /[\uac00-\ud7af\u1100-\u11ff]/g
  const arabicRegex = /[\u0600-\u06ff\u0750-\u077f]/g
  const cyrillicRegex = /[\u0400-\u04ff]/g
  const greekRegex = /[\u0370-\u03ff]/g
  const thaiRegex = /[\u0e00-\u0e7f]/g
  const persianSpecific = /[\u06cc\u06a9\u067e\u0686\u06af\u0698]/g

  const japaneseCount = (text.match(japaneseRegex) || []).length
  const koreanCount = (text.match(koreanRegex) || []).length
  const cjkCount = (text.match(cjkRegex) || []).length
  const arabicCount = (text.match(arabicRegex) || []).length
  const cyrillicCount = (text.match(cyrillicRegex) || []).length
  const greekCount = (text.match(greekRegex) || []).length
  const thaiCount = (text.match(thaiRegex) || []).length
  const persianCount = (text.match(persianSpecific) || []).length

  // Japanese has kana mixed with kanji
  if (japaneseCount > 0) return 'ja'
  // Korean has hangul
  if (koreanCount > 0) return 'ko'
  // CJK without Japanese/Korean kana = Chinese
  if (cjkCount > 5) return 'zh-CN'
  // Persian is a subset of Arabic script with specific characters
  if (persianCount > 0) return 'fa'
  if (arabicCount > 5) return 'ar'
  if (cyrillicCount > 5) {
    // Could be Russian or Ukrainian - check for Ukrainian-specific chars
    const ukrainianSpecific = /[\u0456\u0457\u0491\u0454]/g
    if ((text.match(ukrainianSpecific) || []).length > 0) return 'uk'
    return 'ru'
  }
  if (greekCount > 5) return 'el'
  if (thaiCount > 5) return 'th'

  // For Latin-script languages, use common word detection
  const lower = text.toLowerCase()
  if (/\b(der|die|das|und|ist|ein|ich)\b/.test(lower)) return 'de'
  if (/\b(le|la|les|est|des|une|dans|avec)\b/.test(lower)) return 'fr'
  if (/\b(el|los|las|una|del|por|con|está)\b/.test(lower)) return 'es'
  if (/\b(il|gli|della|una|che|con|nel)\b/.test(lower)) return 'it'
  if (/\b(o|os|uma|dos|das|com|são|está)\b/.test(lower)) return 'pt'
  if (/\b(bir|ve|bu|ile|için|olan|den)\b/.test(lower)) return 'tr'
  if (/\b(dan|yang|di|dengan|dari|ini|itu)\b/.test(lower)) return 'id'

  return 'en'
}

function StorybookView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [storybook, setStorybook] = useState<Storybook | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const [error, setError] = useState('')
  const [userRating, setUserRating] = useState(0)
  const [submittingRating, setSubmittingRating] = useState(false)

  // Audio state (using Web Speech API)
  const [voice, setVoice] = useState<'mom' | 'dad'>('mom')
  const [isPlaying, setIsPlaying] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Generate a unique viewer ID for anonymous rating
  const getViewerId = () => {
    let viewerId = localStorage.getItem('viewer-id')
    if (!viewerId) {
      viewerId = 'viewer-' + Math.random().toString(36).substring(2, 15)
      localStorage.setItem('viewer-id', viewerId)
    }
    return viewerId
  }

  useEffect(() => {
    if (id) {
      loadStorybook(id)
    }
  }, [id])

  const loadStorybook = async (storybookId: string) => {
    setLoading(true)
    try {
      const data = await getStorybook(storybookId)
      if (data) {
        setStorybook(data)
        // Check if user already rated
        const viewerId = getViewerId()
        const existingRating = data.ratings?.find(r => r.oderId === viewerId)
        if (existingRating) {
          setUserRating(existingRating.rating)
        }
      } else {
        setError(t('storybookView.notFound'))
      }
    } catch (err) {
      console.error('Failed to load storybook:', err)
      setError(t('storyEditor.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  const handleRating = async (value: number) => {
    if (!id || submittingRating) return

    setSubmittingRating(true)
    try {
      const viewerId = getViewerId()
      const result = await rateStorybook(id, viewerId, value)
      setUserRating(value)
      setStorybook(prev => prev ? {
        ...prev,
        averageRating: result.averageRating,
        ratingCount: result.ratingCount,
      } : null)
      message.success(t('storybookView.thankYouForRating'))
    } catch (err) {
      console.error('Failed to submit rating:', err)
      message.error(t('storybookView.failedToSubmitRating'))
    } finally {
      setSubmittingRating(false)
    }
  }

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1))
  }

  const handleNextPage = () => {
    if (storybook) {
      setCurrentPage((prev) => Math.min(storybook.frames.length - 1, prev + 1))
    }
  }

  // Find the best voice for the given gender and language
  const findBestVoice = (voices: SpeechSynthesisVoice[], langCode: string, gender: 'female' | 'male'): SpeechSynthesisVoice | null => {
    const langPrefix = langCode.split('-')[0]
    let langVoices: SpeechSynthesisVoice[]

    // For Chinese, strictly match zh-CN (Mandarin) only — exclude Cantonese, Taiwanese, etc.
    if (langCode === 'zh-CN' || langCode === 'zh-TW') {
      langVoices = voices.filter(v => v.lang === 'zh-CN' || v.lang === 'zh')
    } else {
      langVoices = voices.filter(v => v.lang.startsWith(langPrefix) || v.lang.startsWith(langCode))
    }

    if (langVoices.length === 0) return null

    // Chinese-specific voice names (Microsoft Edge/Windows voices)
    const chineseFemaleNames = [
      'xiaoxiao', 'xiaoyi', 'xiaohan', 'xiaomeng', 'xiaomo', 'xiaorui', 'xiaoshuang',
      'xiaoxuan', 'xiaozhen', 'xiaoqiu', 'xiaoyan', 'xiaoyou',
      'huihui', 'yaoyao',
      'hanhan', 'lili', 'meimei',
      'hsiao-chen', 'hsiao-yu', // zh-TW female
      'ting-ting', 'mei-jia', // macOS Chinese female
    ]
    const chineseMaleNames = [
      'yunyang',  // best natural male voice (news anchor style)
      'yunxi',    // young male, natural
      'yunjian',  // sports commentary style
      'yunhao', 'yunfeng', 'yunze', 'yunda', 'yunqi',
      'kangkang', // older Microsoft male voice
      'zhiwei',
      'wan-lung', 'yun-jhe', // zh-TW male
    ]

    // Japanese-specific voice names
    const japaneseFemaleNames = ['nanami', 'aoi', 'shiori', 'mayu', 'kyoko', 'o-ren', 'haruka']
    const japaneseMaleNames = ['keita', 'daichi', 'naoki', 'otoya', 'hattori']

    // Korean-specific voice names
    const koreanFemaleNames = ['sun-hi', 'ji-min', 'seo-hyeon', 'soon-bok', 'yuna']
    const koreanMaleNames = ['in-joon', 'bong-jin', 'hyun-su']

    // Language-specific voice lookup
    const langSpecific: Record<string, { female: string[], male: string[] }> = {
      'zh': { female: chineseFemaleNames, male: chineseMaleNames },
      'ja': { female: japaneseFemaleNames, male: japaneseMaleNames },
      'ko': { female: koreanFemaleNames, male: koreanMaleNames },
    }

    // Try language-specific names first
    const specificNames = langSpecific[langPrefix]
    if (specificNames) {
      const nameList = gender === 'female' ? specificNames.female : specificNames.male
      for (const v of langVoices) {
        const nameLower = v.name.toLowerCase()
        if (nameList.some(n => nameLower.includes(n))) {
          return v
        }
      }
    }

    // General premium voices
    const premiumFemale = ['google us english female', 'google uk english female', 'microsoft zira',
      'microsoft eva', 'samantha', 'karen', 'moira', 'tessa', 'fiona', 'victoria']
    const premiumMale = ['google us english male', 'google uk english male', 'microsoft david',
      'microsoft mark', 'daniel', 'alex', 'thomas', 'oliver', 'james']

    // General gender indicators
    const femaleIndicators = ['female', 'woman', 'girl', 'samantha', 'victoria', 'karen', 'moira',
      'susan', 'zira', 'hazel', 'fiona', 'kate', 'serena', 'veena', 'paulina', 'monica',
      'luciana', 'joana', 'helena', 'milena', 'laura', 'alice', 'amelie', 'anna', 'ellen',
      'sara', 'tessa', 'eva', 'cortana']
    const maleIndicators = ['male', 'man', 'boy', 'daniel', 'alex', 'fred', 'thomas', 'david',
      'george', 'james', 'richard', 'mark', 'lee', 'rishi', 'diego', 'jorge', 'juan',
      'luca', 'oliver', 'aaron', 'carlos', 'ivan', 'tom', 'reed', 'gordon']

    const premiumList = gender === 'female' ? premiumFemale : premiumMale
    const indicators = gender === 'female' ? femaleIndicators : maleIndicators

    // Try premium voices
    for (const v of langVoices) {
      const nameLower = v.name.toLowerCase()
      if (premiumList.some(p => nameLower.includes(p))) {
        return v
      }
    }

    // Try standard gendered voice
    for (const v of langVoices) {
      const nameLower = v.name.toLowerCase()
      if (indicators.some(ind => nameLower.includes(ind))) {
        return v
      }
    }

    // For CJK: if no gendered match found, try to exclude opposite gender voices
    if (['zh', 'ja', 'ko'].includes(langPrefix)) {
      const allFemaleNames = [...(langSpecific[langPrefix]?.female || []), 'female']
      const allMaleNames = [...(langSpecific[langPrefix]?.male || []), 'male']
      const oppositeNames = gender === 'female' ? allMaleNames : allFemaleNames
      const filtered = langVoices.filter(v => !oppositeNames.some(n => v.name.toLowerCase().includes(n)))
      if (filtered.length > 0) return filtered[0]
    }

    return langVoices[0] || null
  }

  // Audio functions using Web Speech API
  const handleReadAloud = () => {
    if (!storybook || !storybook.frames[currentPage]) return
    if (!('speechSynthesis' in window)) {
      message.error(t('audio.failedToGenerate'))
      return
    }

    // Stop any current speech
    window.speechSynthesis.cancel()

    const speakWithVoices = () => {
      const text = storybook.frames[currentPage].caption
      const utterance = new SpeechSynthesisUtterance(text)
      utteranceRef.current = utterance

      // Detect language from the actual text content
      const detectedLang = storybook.language || detectLanguageFromText(text)
      const langCode = languageCodeMap[detectedLang] || 'en-US'
      utterance.lang = langCode

      // Natural speaking rate
      utterance.rate = 0.9

      // Get all available voices
      const voices = window.speechSynthesis.getVoices()

      // Find the best voice for the selected gender
      const gender = voice === 'mom' ? 'female' : 'male'
      // Log available voices for debugging
      const langPrefix = langCode.split('-')[0]
      const availableLangVoices = voices.filter(v => v.lang.startsWith(langPrefix) || v.lang === langCode)
      console.log('Available voices for', langCode, ':', availableLangVoices.map(v => `${v.name} [${v.lang}]`))

      const selectedVoice = findBestVoice(voices, langCode, gender)
      console.log('Selected voice:', selectedVoice?.name, 'for gender:', gender)

      if (selectedVoice) {
        utterance.voice = selectedVoice
        // Adjust pitch more noticeably for dad's voice to sound deeper
        utterance.pitch = voice === 'mom' ? 1.05 : 0.8
      } else {
        // Fallback: use pitch to differentiate more strongly
        utterance.pitch = voice === 'mom' ? 1.2 : 0.6
      }

      utterance.onstart = () => setIsPlaying(true)
      utterance.onend = () => {
        setIsPlaying(false)
        utteranceRef.current = null
      }
      utterance.onerror = () => {
        setIsPlaying(false)
        utteranceRef.current = null
      }

      window.speechSynthesis.speak(utterance)
    }

    // Voices may not be loaded yet, wait for them
    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      speakWithVoices()
    } else {
      // Wait for voices to load
      window.speechSynthesis.onvoiceschanged = () => {
        speakWithVoices()
        window.speechSynthesis.onvoiceschanged = null
      }
      // Fallback timeout
      setTimeout(() => {
        if (!isPlaying) speakWithVoices()
      }, 100)
    }
  }

  const handleStopAudio = () => {
    window.speechSynthesis.cancel()
    setIsPlaying(false)
    utteranceRef.current = null
  }

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [])

  // Stop audio when changing pages
  useEffect(() => {
    handleStopAudio()
  }, [currentPage])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5'
      }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error || !storybook) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
        padding: 24
      }}>
        <BookOutlined style={{ fontSize: 64, color: '#ddd', marginBottom: 24 }} />
        <Title level={3}>{error || t('storybookView.notFound')}</Title>
        <Button type="primary" icon={<HomeOutlined />} onClick={() => navigate('/')}>
          {t('common.home')}
        </Button>
      </div>
    )
  }

  const frames: StoryFrame[] = storybook.frames

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>{storybook.title}</Title>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 16 }}>
              <Text type="secondary">
                <UserOutlined style={{ marginRight: 4 }} />
                {storybook.authorName || t('storybookView.unknownAuthor')}
              </Text>
              {storybook.ratingCount && storybook.ratingCount > 0 && (
                <Text type="secondary">
                  <Rate disabled value={storybook.averageRating} allowHalf style={{ fontSize: 14 }} />
                  <span style={{ marginLeft: 8 }}>
                    {storybook.averageRating?.toFixed(1)} ({storybook.ratingCount} {storybook.ratingCount === 1 ? t('storybookView.rating') : t('storybookView.ratings')})
                  </span>
                </Text>
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {t('home.created')}: {storybook.createdAt.toDate().toLocaleString()}
                {storybook.updatedAt.toMillis() !== storybook.createdAt.toMillis() && (
                  <span style={{ marginLeft: 16 }}>
                    {t('home.updated')}: {storybook.updatedAt.toDate().toLocaleString()}
                  </span>
                )}
              </Text>
            </div>
            {storybook.tags && storybook.tags.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {storybook.tags.map(tag => (
                  <Tag key={tag} color="blue">{tag}</Tag>
                ))}
              </div>
            )}
          </div>
          <Space>
            <LanguageSelector />
            <Button
              icon={<ShareAltOutlined />}
              onClick={() => {
                const shareUrl = window.location.href
                navigator.clipboard.writeText(shareUrl)
                message.success(t('storybookView.shareLinkCopied'))
              }}
            >
              {t('storybookView.share')}
            </Button>
            <Button icon={<HomeOutlined />} onClick={() => navigate('/')}>
              {t('common.home')}
            </Button>
          </Space>
        </div>

        <Card>
          {frames.length > 0 ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  gap: 24,
                  alignItems: 'flex-start',
                  minHeight: 400,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    background: '#f5f5f5',
                    borderRadius: 8,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 350,
                  }}
                >
                  {frames[currentPage]?.imageUrl ? (
                    <Image
                      src={frames[currentPage].imageUrl}
                      alt={`Page ${currentPage + 1}`}
                      style={{ maxWidth: '100%', maxHeight: 400 }}
                      preview={true}
                    />
                  ) : (
                    <div style={{ color: '#999', padding: 24, textAlign: 'center' }}>
                      <BookOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                      <div>{t('storybookView.noImageAvailable')}</div>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    flex: 1,
                    padding: 24,
                    background: '#fafafa',
                    borderRadius: 8,
                    minHeight: 350,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      color: '#6366f1',
                      fontWeight: 600,
                      marginBottom: 16,
                    }}
                  >
                    {t('storyEditor.page')} {currentPage + 1} {t('storyEditor.of')} {frames.length}
                  </div>
                  <Paragraph
                    style={{
                      fontSize: 18,
                      lineHeight: 1.8,
                      flex: 1,
                    }}
                  >
                    {frames[currentPage]?.caption}
                  </Paragraph>

                  {/* Audio Controls */}
                  <div style={{
                    marginTop: 16,
                    paddingTop: 16,
                    borderTop: '1px solid #eee',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap'
                  }}>
                    <Select
                      value={voice}
                      onChange={(v) => setVoice(v)}
                      style={{ width: 140 }}
                      disabled={isPlaying}
                      options={[
                        { value: 'mom', label: t('audio.momsVoice') },
                        { value: 'dad', label: t('audio.dadsVoice') },
                      ]}
                    />
                    {isPlaying ? (
                      <Button
                        icon={<PauseCircleOutlined />}
                        onClick={handleStopAudio}
                        type="primary"
                        danger
                      >
                        {t('audio.stop')}
                      </Button>
                    ) : (
                      <Button
                        icon={<SoundOutlined />}
                        onClick={handleReadAloud}
                        type="primary"
                      >
                        {t('audio.readAloud')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 24,
                  marginTop: 24,
                }}
              >
                <Button
                  icon={<LeftOutlined />}
                  onClick={handlePrevPage}
                  disabled={currentPage === 0}
                >
                  {t('storyEditor.previous')}
                </Button>
                <span style={{ color: '#666' }}>
                  {currentPage + 1} / {frames.length}
                </span>
                <Button
                  icon={<RightOutlined />}
                  onClick={handleNextPage}
                  disabled={currentPage === frames.length - 1}
                >
                  {t('storyEditor.next')}
                </Button>
              </div>

              <div
                style={{
                  marginTop: 24,
                  display: 'flex',
                  gap: 8,
                  overflowX: 'auto',
                  padding: '8px 0',
                }}
              >
                {frames.map((frame, index) => (
                  <div
                    key={index}
                    onClick={() => setCurrentPage(index)}
                    style={{
                      cursor: 'pointer',
                      border: currentPage === index ? '3px solid #6366f1' : '3px solid transparent',
                      borderRadius: 8,
                      overflow: 'hidden',
                      flexShrink: 0,
                      position: 'relative',
                    }}
                  >
                    {frame.imageUrl ? (
                      <img
                        src={frame.imageUrl}
                        alt={`Thumbnail ${index + 1}`}
                        style={{ width: 80, height: 60, objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 80,
                          height: 60,
                          background: '#eee',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#999',
                          fontSize: 12,
                        }}
                      >
                        {t('storyEditor.noImage')}
                      </div>
                    )}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 2,
                        right: 4,
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        fontSize: 10,
                        padding: '1px 4px',
                        borderRadius: 4,
                      }}
                    >
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <BookOutlined style={{ fontSize: 64, color: '#ddd', marginBottom: 16 }} />
              <Paragraph style={{ color: '#999' }}>
                {t('storybookView.noPages')}
              </Paragraph>
            </div>
          )}
        </Card>

        {/* Rating Section */}
        <Card style={{ marginTop: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={4} style={{ marginBottom: 16 }}>{t('storybookView.rateStorybook')}</Title>
            <Rate
              value={userRating}
              onChange={handleRating}
              disabled={submittingRating}
              style={{ fontSize: 32 }}
            />
            {userRating > 0 && (
              <Paragraph style={{ marginTop: 8, color: '#666' }}>
                {t('storybookView.youRated', { count: userRating })}
              </Paragraph>
            )}
          </div>
        </Card>

        <div style={{ textAlign: 'center', marginTop: 24, color: '#999', fontSize: 12 }}>
          &copy; {new Date().getFullYear()} {t('app.copyright')}
        </div>
      </div>
    </div>
  )
}

export default StorybookView
