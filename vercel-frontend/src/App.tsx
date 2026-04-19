import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { Github, Globe, Terminal, Loader2 } from 'lucide-react'

const socket = io('http://localhost:9000')

function App() {
  const [repoUrl, setRepoUrl] = useState('')
  const [customSlug, setCustomSlug] = useState('')
  const [rootPrefix, setRootPrefix] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [isDeploying, setIsDeploying] = useState(false)
  const [deployUrl, setDeployUrl] = useState('')
  const [projectSlug, setProjectSlug] = useState('')
  
  const logContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [logs, scrollToBottom])

  useEffect(() => {
    const handleMessage = (data: string) => {
      const parsedData = JSON.parse(data)
      if (parsedData.log) {
        setLogs((prev) => [...prev, parsedData.log])
      }
    }

    socket.on('message', handleMessage)

    return () => {
      socket.off('message', handleMessage)
    }
  }, [])

  const handleDeploy = async () => {
    if (!repoUrl) return

    setIsDeploying(true)
    setLogs(['Initiating deployment...'])
    setDeployUrl('')

    try {
      const response = await fetch('http://localhost:9000/project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          gitURL: repoUrl,
          slug: customSlug,
          rootPrefix: rootPrefix 
        }),
      })

      const result = await response.json()
      
      if (result.data) {
        const { projectSlug, url } = result.data
        setProjectSlug(projectSlug)
        setDeployUrl(url)
        
        socket.emit('subscribe', `logs:${projectSlug}`)
        setLogs((prev) => [...prev, `Subscribed to logs for ${projectSlug}`])
      }
    } catch (error) {
      console.error('Deployment failed:', error)
      setLogs((prev) => [...prev, 'Error: Failed to trigger deployment.'])
      setIsDeploying(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-zinc-200 font-sans selection:bg-zinc-800">
      <nav className="border-b border-zinc-800 p-4 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-black mb-0.5"></div>
            </div>
            <span className="font-bold text-xl tracking-tight text-white">Vercel Clone</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <span className="hover:text-white cursor-pointer transition-colors">Documentation</span>
            <span className="hover:text-white cursor-pointer transition-colors">Github</span>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-6 md:p-12">
        <div className="grid gap-8">
          <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 md:p-8 shadow-2xl">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-white">
              <Github className="w-5 h-5" />
              Import Repository
            </h2>
            <div className="grid gap-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-[2]">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Github Repository URL</label>
                  <input
                    type="text"
                    placeholder="https://github.com/username/repo"
                    className="w-full bg-black border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all text-zinc-300"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Custom Slug (Optional)</label>
                  <input
                    type="text"
                    placeholder="my-cool-project"
                    className="w-full bg-black border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all text-zinc-300"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                  />
                </div>
                <div className="flex-none md:w-48">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Root Directory</label>
                  <input
                    type="text"
                    placeholder="/frontend"
                    className="w-full bg-black border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all text-zinc-300"
                    value={rootPrefix}
                    onChange={(e) => setRootPrefix(e.target.value)}
                  />
                </div>
              </div>
              <button
                onClick={handleDeploy}
                disabled={isDeploying && !deployUrl}
                className="bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 font-bold py-3 px-8 rounded-lg transition-all flex items-center justify-center gap-2 w-full md:w-max ml-auto"
              >
                {isDeploying && !deployUrl ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deploying
                  </>
                ) : (
                  'Deploy'
                )}
              </button>
            </div>
          </section>

          {deployUrl && (
            <section className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-500">Deployment Successful</h3>
                  <p className="text-emerald-500/60 text-sm">Your project is live at the URL below.</p>
                </div>
              </div>
              <a
                href={deployUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-500 text-black font-bold py-2 px-6 rounded-lg hover:bg-emerald-400 transition-all flex items-center gap-2 text-sm"
              >
                Visit Site
                <Globe className="w-4 h-4" />
              </a>
            </section>
          )}

          <section className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col shadow-inner">
            <div className="bg-zinc-900/80 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                <Terminal className="w-3 h-3" />
                Build Logs {projectSlug && `— ${projectSlug}`}
              </div>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-800"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-800"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-800"></div>
              </div>
            </div>
            <div 
              ref={logContainerRef}
              className="h-[400px] overflow-y-auto p-4 font-mono text-sm space-y-1 scroll-smooth"
            >
              {logs.length === 0 ? (
                <div className="text-zinc-700 italic">No logs to display. Trigger a deployment to see progress.</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="flex gap-3 border-b border-zinc-900/50 pb-1 last:border-0">
                    <span className="text-zinc-600 shrink-0 select-none">[{index + 1}]</span>
                    <span className={log.toLowerCase().includes('error') ? 'text-red-400' : 'text-zinc-300'}>
                      {log}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto p-12 text-center text-zinc-600 text-sm border-t border-zinc-900 mt-12">
        Built with Node.js, AWS ECS, S3, Redis, and Socket.io
      </footer>
    </div>
  )
}

export default App
