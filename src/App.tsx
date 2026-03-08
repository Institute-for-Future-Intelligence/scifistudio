import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Home from './pages/Home'
import StoryEditor from './pages/StoryEditor'
import VideoEditor from './pages/VideoEditor'

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path="story/:id?" element={<StoryEditor />} />
        <Route path="video/:id?" element={<VideoEditor />} />
      </Route>
    </Routes>
  )
}

export default App
