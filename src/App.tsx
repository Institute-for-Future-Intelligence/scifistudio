import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Home from './pages/Home'
import StoryEditor from './pages/StoryEditor'
import VideoEditor from './pages/VideoEditor'
import StorybookView from './pages/StorybookView'

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path="story/:id?" element={<StoryEditor />} />
        <Route path="video/:id?" element={<VideoEditor />} />
      </Route>
      <Route path="view/:id" element={<StorybookView />} />
    </Routes>
  )
}

export default App
