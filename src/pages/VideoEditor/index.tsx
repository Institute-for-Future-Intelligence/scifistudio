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
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Typography,
  Card,
  Input,
  Button,
  Slider,
  Space,
  message,
  Modal,
  List,
  Spin,
} from 'antd'
import {
  PlayCircleOutlined,
  PlusOutlined,
  SaveOutlined,
  UploadOutlined,
  HomeOutlined,
  DeleteOutlined,
  BulbOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import {
  generateVideo,
  enhanceVideoPrompt,
  generateVideoTags,
  VideoResult,
} from '../../services/gemini'
import {
  getVideos,
  getVideo,
  createVideo,
  updateVideo,
  deleteVideo,
  Video,
} from '../../services/firestore'
import { uploadBase64Video, deleteVideoFiles } from '../../services/storage'
import TagEditor from '../../components/common/TagEditor'

import { Timestamp } from 'firebase/firestore'

const { Title, Paragraph, Text } = Typography
const { TextArea } = Input

function VideoEditor() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Form state
  const [title, setTitle] = useState(() => localStorage.getItem('videoEditor_title') || '')
  const [prompt, setPrompt] = useState(() => localStorage.getItem('videoEditor_prompt') || '')
  const [duration, setDuration] = useState(8)
  const [enhancedPrompt, setEnhancedPrompt] = useState(() => localStorage.getItem('videoEditor_enhancedPrompt') || '')

  // Video state
  const [videoUrl, setVideoUrl] = useState('')
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState('')
  const [isImage, setIsImage] = useState(false)
  const [tags, setTags] = useState<string[]>([])

  // UI state
  const [generating, setGenerating] = useState(false)
  const [generatingTags, setGeneratingTags] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadModalOpen, setLoadModalOpen] = useState(false)
  const [savedVideos, setSavedVideos] = useState<Video[]>([])
  const [loadingVideos, setLoadingVideos] = useState(false)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [generationStatus, setGenerationStatus] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [createdAt, setCreatedAt] = useState<Timestamp | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Timestamp | null>(null)

  // Refs for async operations
  const videoIdRef = useRef<string | null>(null)
  const pendingTagsRef = useRef<string[] | null>(null)

  // Persist text inputs to localStorage
  useEffect(() => { localStorage.setItem('videoEditor_title', title) }, [title])
  useEffect(() => { localStorage.setItem('videoEditor_prompt', prompt) }, [prompt])
  useEffect(() => { localStorage.setItem('videoEditor_enhancedPrompt', enhancedPrompt) }, [enhancedPrompt])

  const clearLocalDraft = () => {
    localStorage.removeItem('videoEditor_title')
    localStorage.removeItem('videoEditor_prompt')
    localStorage.removeItem('videoEditor_enhancedPrompt')
  }

  // Extract thumbnail from video element
  const extractThumbnail = (videoSrc: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.crossOrigin = 'anonymous'
      video.muted = true
      video.preload = 'auto'

      video.onloadeddata = () => {
        // Seek to 1 second or 25% of duration, whichever is smaller
        video.currentTime = Math.min(1, video.duration * 0.25)
      }

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) { reject(new Error('No canvas context')); return }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
          resolve(dataUrl)
        } catch (err) {
          reject(err)
        } finally {
          video.remove()
        }
      }

      video.onerror = () => {
        video.remove()
        reject(new Error('Failed to load video for thumbnail'))
      }

      video.src = videoSrc
    })
  }

  // Track unsaved changes
  useEffect(() => {
    if (videoUrl && !videoId) {
      setHasUnsavedChanges(true)
    }
  }, [videoUrl, videoId])

  // Confirm navigation helper
  const confirmNavigation = (callback: () => void) => {
    if (hasUnsavedChanges) {
      if (window.confirm(t('videoEditor.unsavedChangesMessage'))) {
        callback()
      }
    } else {
      callback()
    }
  }

  // Load video from URL parameter
  const lastLoadedIdRef = useRef<string | null>(null)

  useEffect(() => {
    const id = searchParams.get('id')
    if (id && user && id !== lastLoadedIdRef.current) {
      lastLoadedIdRef.current = id
      loadVideoById(id)
    }
  }, [searchParams, user])

  const loadVideoById = async (id: string) => {
    try {
      const video = await getVideo(id)
      if (video) {
        setTitle(video.title)
        setPrompt(video.prompt)
        setVideoUrl(video.videoUrl)
        setIsImage(video.videoUrl.includes('.png') || video.videoUrl.startsWith('data:image'))
        setDuration(video.durationSeconds || 8)
        setTags(video.tags || [])
        setCreatedAt(video.createdAt)
        setUpdatedAt(video.updatedAt)
        setVideoId(id)
        videoIdRef.current = id
        setHasUnsavedChanges(false)
        clearLocalDraft()
        message.success(t('videoEditor.videoLoaded'))
      } else {
        message.error(t('videoEditor.videoNotFound'))
      }
    } catch (error) {
      console.error('Failed to load video:', error)
      message.error(t('videoEditor.failedToLoad'))
    }
  }

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) {
      message.warning(t('videoEditor.enterIdeaFirst'))
      return
    }

    setEnhancing(true)
    try {
      const enhanced = await enhanceVideoPrompt(prompt)
      setEnhancedPrompt(enhanced)
      message.success(t('videoEditor.conceptEnhanced'))
    } catch (error) {
      console.error('Failed to enhance prompt:', error)
      message.error(t('videoEditor.failedToEnhance'))
    } finally {
      setEnhancing(false)
    }
  }

  const handleGenerateVideo = async () => {
    if (!title.trim()) {
      message.warning(t('videoEditor.enterTitleFirst'))
      return
    }
    if (!prompt.trim()) {
      message.warning(t('videoEditor.enterIdeaFirst'))
      return
    }

    setGenerating(true)
    setVideoUrl('')
    setThumbnailDataUrl('')
    setIsImage(false)
    setTags([])
    setVideoId(null)
    videoIdRef.current = null

    try {
      const finalPrompt = enhancedPrompt || prompt
      const result: VideoResult = await generateVideo(finalPrompt, duration, setGenerationStatus)

      setVideoUrl(result.videoUrl)
      setIsImage(result.isImage || false)

      // Extract thumbnail from video, or use image directly as thumbnail
      let thumbDataUrl = ''
      if (result.isImage) {
        thumbDataUrl = result.videoUrl
        setThumbnailDataUrl(result.videoUrl)
        message.info(result.message || 'Video generation not available. Generated image instead.')
      } else {
        message.success(t('videoEditor.videoGenerated'))
        try {
          thumbDataUrl = await extractThumbnail(result.videoUrl)
          setThumbnailDataUrl(thumbDataUrl)
        } catch (err) {
          console.error('Failed to extract thumbnail:', err)
        }
      }

      setHasUnsavedChanges(true)

      // Generate tags (non-blocking)
      setGeneratingTags(true)
      generateVideoTags(finalPrompt, title)
        .then(async (generatedTags) => {
          setTags(generatedTags)
          pendingTagsRef.current = generatedTags

          // Auto-save tags if video already saved
          if (videoIdRef.current) {
            updateVideo(videoIdRef.current, { tags: generatedTags })
          }
        })
        .catch((err) => console.error('Failed to generate tags:', err))
        .finally(() => setGeneratingTags(false))
    } catch (error) {
      console.error('Failed to generate video:', error)
      message.error(t('videoEditor.failedToGenerate'))
    } finally {
      setGenerating(false)
      setGenerationStatus('')
    }
  }

  const saveVideo = async (
    videoData: string,
    thumbData: string,
    tagsData: string[],
    currentVideoId: string | null,
    showMessages = true,
  ) => {
    if (!user) return
    if (!videoData || !title.trim()) return

    const tagsToSave = tagsData

    // Upload video/image to Storage if it's a base64 data URI
    let savedUrl = videoData
    const saveId = currentVideoId || crypto.randomUUID()
    if (videoData.startsWith('data:')) {
      if (currentVideoId) {
        await deleteVideoFiles(user.uid, currentVideoId)
      }
      const ext = videoData.startsWith('data:video') ? 'mp4' : 'png'
      const path = `videos/${user.uid}/${saveId}/video.${ext}`
      savedUrl = await uploadBase64Video(videoData, path)
    }

    // Upload thumbnail to Storage
    let savedThumbnailUrl = ''
    if (thumbData && thumbData.startsWith('data:')) {
      try {
        const thumbPath = `videos/${user.uid}/${saveId}/thumbnail.jpg`
        savedThumbnailUrl = await uploadBase64Video(thumbData, thumbPath)
      } catch (err) {
        console.error('Failed to upload thumbnail:', err)
      }
    }

    if (currentVideoId) {
      const updateData: Record<string, unknown> = {
        title,
        prompt: enhancedPrompt || prompt,
        videoUrl: savedUrl,
        durationSeconds: duration,
        tags: tagsToSave,
      }
      if (savedThumbnailUrl) {
        updateData.thumbnailUrl = savedThumbnailUrl
      }
      await updateVideo(currentVideoId, updateData)
      if (showMessages) message.success(t('videoEditor.videoUpdated'))
    } else {
      const newId = await createVideo({
        userId: user.uid,
        authorName: user.displayName || t('auth.guest'),
        title,
        prompt: enhancedPrompt || prompt,
        videoUrl: savedUrl,
        thumbnailUrl: savedThumbnailUrl,
        durationSeconds: duration,
        tags: tagsToSave,
        status: 'completed',
      })
      setVideoId(newId)
      videoIdRef.current = newId
      pendingTagsRef.current = null
      if (showMessages) message.success(t('videoEditor.videoSaved'))
    }
    setHasUnsavedChanges(false)
    clearLocalDraft()
  }

  const handleSave = async () => {
    if (!user) return
    if (!videoUrl) {
      message.warning(t('videoEditor.generateFirst'))
      return
    }
    if (!title.trim()) {
      message.warning(t('videoEditor.enterTitleFirst'))
      return
    }

    setSaving(true)
    try {
      await saveVideo(videoUrl, thumbnailDataUrl, pendingTagsRef.current || tags, videoId)
    } catch (error) {
      console.error('Failed to save video:', error)
      message.error(t('videoEditor.failedToSave'))
    } finally {
      setSaving(false)
    }
  }

  const handleNew = () => {
    confirmNavigation(() => {
      setTitle('')
      setPrompt('')
      setEnhancedPrompt('')
      setVideoUrl('')
      setThumbnailDataUrl('')
      setTags([])
      setCreatedAt(null)
      setUpdatedAt(null)
      setVideoId(null)
      videoIdRef.current = null
      lastLoadedIdRef.current = null
      setHasUnsavedChanges(false)
      clearLocalDraft()
      navigate('/video')
    })
  }

  const handleLoadClick = async () => {
    if (!user) return
    setLoadModalOpen(true)
    setLoadingVideos(true)
    try {
      const videos = await getVideos(user.uid)
      setSavedVideos(videos)
    } catch (error) {
      console.error('Failed to load videos:', error)
      message.error(t('videoEditor.failedToLoad'))
    } finally {
      setLoadingVideos(false)
    }
  }

  const handleLoadVideo = (video: Video) => {
    confirmNavigation(() => {
      setTitle(video.title)
      setPrompt(video.prompt)
      setVideoUrl(video.videoUrl)
      setIsImage(video.videoUrl.includes('.png') || video.videoUrl.startsWith('data:image'))
      setDuration(video.durationSeconds || 8)
      setTags(video.tags || [])
      setCreatedAt(video.createdAt)
      setUpdatedAt(video.updatedAt)
      setVideoId(video.id || null)
      videoIdRef.current = video.id || null
      setHasUnsavedChanges(false)
      clearLocalDraft()
      setLoadModalOpen(false)
    })
  }

  const handleDeleteVideo = async (video: Video) => {
    if (!video.id) return
    try {
      await deleteVideo(video.id)
      setSavedVideos((prev) => prev.filter((v) => v.id !== video.id))
      message.success(t('videoEditor.videoDeleted'))
    } catch (error) {
      console.error('Failed to delete video:', error)
      message.error(t('videoEditor.failedToDelete'))
    }
  }

  const handleTagsChange = useCallback((newTags: string[]) => {
    setTags(newTags)
    setHasUnsavedChanges(true)
    message.info(t('tags.rememberToSave'))
  }, [t])

  const handleHomeClick = () => {
    confirmNavigation(() => navigate('/'))
  }

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            {videoId ? t('videoEditor.editVideo') : t('videoEditor.title')}
          </Title>
          <Paragraph style={{ color: '#666', margin: 0 }}>
            {t('videoEditor.description')}
          </Paragraph>
          {createdAt && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t('home.created')}: {createdAt.toDate().toLocaleString()}
              {updatedAt && updatedAt.toMillis() !== createdAt.toMillis() && (
                <span style={{ marginLeft: 16 }}>
                  {t('home.updated')}: {updatedAt.toDate().toLocaleString()}
                </span>
              )}
            </Text>
          )}
        </div>
        <Space>
          <Button icon={<HomeOutlined />} onClick={handleHomeClick}>
            {t('common.home')}
          </Button>
          <Button icon={<PlusOutlined />} onClick={handleNew}>
            {t('storyEditor.new')}
          </Button>
          <Button icon={<UploadOutlined />} onClick={handleLoadClick}>
            {t('storyEditor.load')}
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!videoUrl}
          >
            {videoId ? t('storyEditor.update') : t('storyEditor.save')}
          </Button>
          <Button
            icon={<EyeOutlined />}
            onClick={() => {
              if (!videoId) {
                message.warning(t('videoEditor.saveFirstToPublish'))
                return
              }
              const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL}watch/${videoId}`
              window.open(shareUrl, '_blank')
            }}
            disabled={!videoId}
          >
            {t('storyEditor.view')}
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Left column - Form */}
        <div style={{ flex: 1 }}>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {/* Title */}
              <div>
                <Text strong>{t('videoEditor.videoTitle')} <span style={{ color: '#ff4d4f' }}>*</span></Text>
                <Input
                  placeholder={t('videoEditor.videoTitlePlaceholder')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ marginTop: 8 }}
                  disabled={generating}
                />
              </div>

              {/* Prompt */}
              <div>
                <Text strong>{t('videoEditor.videoIdea')} <span style={{ color: '#ff4d4f' }}>*</span></Text>
                <TextArea
                  placeholder={t('videoEditor.videoIdeaPlaceholder')}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  style={{ marginTop: 8 }}
                  disabled={generating}
                />
                <Button
                  type="link"
                  icon={<BulbOutlined />}
                  onClick={handleEnhancePrompt}
                  loading={enhancing}
                  style={{ padding: 0, marginTop: 8 }}
                >
                  {t('videoEditor.enhanceConcept')}
                </Button>
              </div>

              {/* Enhanced Prompt */}
              {enhancedPrompt && (
                <div>
                  <Text strong>{t('videoEditor.enhancedConcept')}</Text>
                  <div
                    style={{
                      marginTop: 8,
                      padding: 12,
                      background: '#f5f5f5',
                      borderRadius: 4,
                      fontSize: 13,
                    }}
                  >
                    {enhancedPrompt}
                  </div>
                </div>
              )}

              {/* Duration */}
              <div>
                <Text strong>{t('videoEditor.duration')}</Text>
                <div style={{ padding: '8px 0' }}>
                  <Slider
                    min={4}
                    max={8}
                    step={2}
                    value={duration}
                    onChange={setDuration}
                    marks={{ 4: '4s', 6: '6s', 8: '8s' }}
                    disabled={generating}
                  />
                </div>
              </div>

              {/* Generate Button */}
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={handleGenerateVideo}
                loading={generating}
                disabled={!title.trim() || !prompt.trim()}
                block
              >
                {generating
                  ? generationStatus || t('videoEditor.generating')
                  : t('videoEditor.generateVideo')}
              </Button>
            </Space>
          </Card>
        </div>

        {/* Right column - Preview */}
        <div style={{ flex: 1 }}>
          <Card title={t('videoEditor.videoPreview')}>
            {generating ? (
              <div
                style={{
                  minHeight: 300,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Spin size="large" />
                <Text style={{ marginTop: 16, color: '#666' }}>
                  {generationStatus || t('videoEditor.generating')}
                </Text>
              </div>
            ) : videoUrl ? (
              <div>
                {isImage ? (
                  <img
                    src={videoUrl}
                    alt="Generated scene"
                    style={{
                      width: '100%',
                      borderRadius: 8,
                      background: '#000',
                    }}
                  />
                ) : (
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    loop
                    style={{
                      width: '100%',
                      borderRadius: 8,
                      background: '#000',
                    }}
                  />
                )}
                {isImage && (
                  <Text type="secondary" style={{ display: 'block', marginTop: 8, textAlign: 'center' }}>
                    Video generation (Veo API) is not available. Showing generated image instead.
                  </Text>
                )}
                <div style={{ marginTop: 16 }}>
                  <TagEditor
                    tags={tags}
                    onChange={handleTagsChange}
                    editable={true}
                    loading={generatingTags}
                  />
                </div>
              </div>
            ) : (
              <div
                style={{
                  minHeight: 300,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PlayCircleOutlined
                  style={{ fontSize: 64, color: '#ddd', marginBottom: 16 }}
                />
                <Text style={{ color: '#999' }}>
                  {t('videoEditor.previewPlaceholder')}
                </Text>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Load Modal */}
      <Modal
        title={t('videoEditor.loadVideo')}
        open={loadModalOpen}
        onCancel={() => setLoadModalOpen(false)}
        footer={null}
        width={600}
      >
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          {loadingVideos ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin />
            </div>
          ) : (
            <List
              dataSource={savedVideos}
              pagination={{
                pageSize: 10,
                size: 'small',
                showSizeChanger: false,
              }}
              renderItem={(video) => (
                <List.Item
                  actions={[
                    <Button
                      key="load"
                      type="link"
                      onClick={() => handleLoadVideo(video)}
                    >
                      {t('storyEditor.load')}
                    </Button>,
                    <Button
                      key="delete"
                      type="link"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteVideo(video)}
                    />,
                  ]}
                >
                  <List.Item.Meta
                    title={video.title}
                    description={
                      video.prompt.length > 100
                        ? video.prompt.substring(0, 100) + '...'
                        : video.prompt
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: t('videoEditor.noSavedVideos') }}
            />
          )}
        </div>
      </Modal>
    </div>
  )
}

export default VideoEditor
