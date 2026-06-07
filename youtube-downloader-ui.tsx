import { useState, useEffect } from 'react';
import { Download, Settings, Folder, Music, Film, Check, X, ChevronDown, Search, Home, Library, History, Trash2 } from 'lucide-react';

export default function YouTubeDownloader() {
  const [activeTab, setActiveTab] = useState('home');
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState('mp4');
  const [selectedQuality, setSelectedQuality] = useState('1080p');
  const [downloadLocation, setDownloadLocation] = useState('/Users/username/Downloads');
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);
  const [showQualityDropdown, setShowQualityDropdown] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [downloadQueue, setDownloadQueue] = useState([
    { id: 1, title: 'Summer Hits Mix 2025', thumbnail: 'https://picsum.photos/id/1/600/400', progress: 100, type: 'audio', format: 'mp3', size: '128 MB' },
    { id: 2, title: 'React Tutorial for Beginners', thumbnail: 'https://picsum.photos/id/2/600/400', progress: 75, type: 'video', format: 'mp4', size: '345 MB' },
    { id: 3, title: 'Warsaw City Tour 2025', thumbnail: 'https://picsum.photos/id/3/600/400', progress: 45, type: 'video', format: 'mp4', size: '512 MB' },
  ]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  const formats = {
    video: ['mp4', 'mkv', 'avi', 'webm'],
    audio: ['mp3', 'aac', 'wav', 'ogg', 'flac']
  };
  
  const qualities = {
    video: ['4K', '1440p', '1080p', '720p', '480p', '360p'],
    audio: ['320kbps', '256kbps', '192kbps', '128kbps', '96kbps']
  };
  
  useEffect(() => {
    if (isDownloading) {
      const interval = setInterval(() => {
        setDownloadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsDownloading(false);
            return 100;
          }
          return prev + 1;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isDownloading]);
  
  const handleUrlChange = (e) => {
    setUrl(e.target.value);
  };
  
  const handleAnalyze = () => {
    if (!url) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
    }, 1500);
  };
  
  const handleDownload = () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    
    // Simulate adding to queue
    const newDownload = { 
      id: downloadQueue.length + 4, 
      title: 'New Downloaded Video', 
      thumbnail: 'https://picsum.photos/id/4/600/400', 
      progress: 0, 
      type: selectedFormat === 'mp3' ? 'audio' : 'video',
      format: selectedFormat,
      size: '250 MB'
    };
    
    setDownloadQueue(prev => [...prev, newDownload]);
  };
  
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };
  
  const mainBg = darkMode ? 'bg-gray-900' : 'bg-gray-50';
  const sidebarBg = darkMode ? 'bg-gray-950' : 'bg-gray-100';
  const cardBg = darkMode ? 'bg-gray-800' : 'bg-white';
  const textColor = darkMode ? 'text-white' : 'text-gray-800';
  const secondaryTextColor = darkMode ? 'text-gray-400' : 'text-gray-500';
  const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
  const inputBg = darkMode ? 'bg-gray-800' : 'bg-white';
  const hoverBg = darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200';
  const activeBg = darkMode ? 'bg-blue-900/30' : 'bg-blue-50';
  
  return (
    <div className={`flex h-screen w-full ${mainBg} ${textColor} transition-colors duration-200`}>
      {/* Sidebar */}
      <div className={`w-64 ${sidebarBg} border-r ${borderColor} flex flex-col`}>
        <div className="p-4 flex items-center space-x-2 border-b border-gray-700">
          <div className="bg-gradient-to-br from-red-500 to-pink-600 w-10 h-10 rounded-lg flex items-center justify-center">
            <Download size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-bold">TubeDown Pro</h1>
        </div>
        
        <div className="flex-1 py-4">
          <div className="px-3 mb-6">
            <div className={`flex items-center space-x-2 p-2 rounded-lg ${activeTab === 'home' ? activeBg : ''} ${hoverBg} cursor-pointer`}
                 onClick={() => setActiveTab('home')}>
              <Home size={20} className={activeTab === 'home' ? 'text-blue-500' : secondaryTextColor} />
              <span className={activeTab === 'home' ? 'font-medium' : ''}>Strona główna</span>
            </div>
            <div className={`flex items-center space-x-2 p-2 rounded-lg ${activeTab === 'library' ? activeBg : ''} ${hoverBg} cursor-pointer`}
                 onClick={() => setActiveTab('library')}>
              <Library size={20} className={activeTab === 'library' ? 'text-blue-500' : secondaryTextColor} />
              <span className={activeTab === 'library' ? 'font-medium' : ''}>Biblioteka</span>
            </div>
            <div className={`flex items-center space-x-2 p-2 rounded-lg ${activeTab === 'history' ? activeBg : ''} ${hoverBg} cursor-pointer`}
                 onClick={() => setActiveTab('history')}>
              <History size={20} className={activeTab === 'history' ? 'text-blue-500' : secondaryTextColor} />
              <span className={activeTab === 'history' ? 'font-medium' : ''}>Historia</span>
            </div>
          </div>
          
          <div className="px-4 py-2">
            <h3 className={`text-xs uppercase font-semibold mb-2 ${secondaryTextColor}`}>Kolejka pobierania</h3>
            <div className="space-y-3">
              {downloadQueue.slice(0, 3).map((item) => (
                <div key={item.id} className={`p-2 rounded-lg ${cardBg} flex items-center`}>
                  <div className="w-8 h-8 rounded bg-gray-700 overflow-hidden flex-shrink-0">
                    {item.type === 'audio' ? (
                      <Music size={18} className="m-auto text-gray-400" />
                    ) : (
                      <Film size={18} className="m-auto text-gray-400" />
                    )}
                  </div>
                  <div className="ml-2 flex-1 truncate">
                    <div className="text-sm truncate">{item.title}</div>
                    <div className="w-full h-1 bg-gray-700 rounded-full mt-1">
                      <div 
                        className="h-full bg-blue-500 rounded-full" 
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              
              {downloadQueue.length > 3 && (
                <div className={`text-xs ${secondaryTextColor} text-center`}>
                  +{downloadQueue.length - 3} więcej w kolejce
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className={`p-4 border-t ${borderColor}`}>
          <div className={`flex items-center space-x-2 p-2 rounded-lg ${hoverBg} cursor-pointer`}
               onClick={() => setActiveTab('settings')}>
            <Settings size={20} className={secondaryTextColor} />
            <span>Ustawienia</span>
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm">Tryb ciemny</span>
            <button 
              onClick={toggleDarkMode}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${darkMode ? 'translate-x-6' : ''}`} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className={`h-16 border-b ${borderColor} flex items-center justify-between px-6`}>
          <div className="relative w-1/2">
            <Search 
              size={18} 
              className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isSearchFocused ? 'text-blue-500' : secondaryTextColor}`}
            />
            <input 
              type="text" 
              placeholder="Szukaj w historii pobierania..." 
              className={`w-full pl-10 pr-4 py-2 rounded-lg ${inputBg} border ${isSearchFocused ? 'border-blue-500' : borderColor} focus:outline-none`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <button className={`p-2 rounded-lg ${hoverBg}`}>
              <Trash2 size={20} className={secondaryTextColor} />
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white text-sm font-medium">JK</span>
            </div>
          </div>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'home' && (
            <div>
              <div className={`${cardBg} rounded-2xl p-8 border ${borderColor} shadow-lg`}>
                <h2 className="text-2xl font-bold mb-6">Pobierz film lub muzykę</h2>
                
                <div className="flex items-center space-x-4">
                  <div className={`flex-1 relative ${inputBg} rounded-lg border ${borderColor}`}>
                    <input 
                      type="text" 
                      value={url}
                      onChange={handleUrlChange}
                      placeholder="Wklej link do YouTube..." 
                      className={`w-full px-4 py-3 bg-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                  
                  <button 
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !url}
                    className={`px-4 py-3 bg-blue-600 text-white rounded-lg font-medium flex items-center space-x-2 hover:bg-blue-700 transition-colors ${(!url || isAnalyzing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span>{isAnalyzing ? 'Analizowanie...' : 'Analizuj'}</span>
                  </button>
                </div>
                
                {url && !isAnalyzing && (
                  <div className="mt-8 grid grid-cols-2 gap-8">
                    <div className={`${cardBg} border ${borderColor} rounded-xl overflow-hidden`}>
                      <div className="h-48 bg-gray-700 relative">
                        <img 
                          src="https://picsum.photos/id/237/600/400" 
                          alt="Video thumbnail" 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4">
                          <div>
                            <div className="text-white font-medium">How to Design Professional UI in React</div>
                            <div className="text-gray-300 text-sm mt-1">YouTube • 15:42</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="relative">
                            <button 
                              onClick={() => setShowFormatDropdown(!showFormatDropdown)}
                              className={`flex items-center space-x-2 px-3 py-2 ${inputBg} border ${borderColor} rounded-lg`}
                            >
                              <span>Format: {selectedFormat.toUpperCase()}</span>
                              <ChevronDown size={16} />
                            </button>
                            
                            {showFormatDropdown && (
                              <div className={`absolute top-full left-0 mt-1 w-48 ${cardBg} border ${borderColor} rounded-lg shadow-xl z-10`}>
                                <div className="p-2">
                                  <div className="font-medium px-3 py-1 text-sm">Video</div>
                                  {formats.video.map(format => (
                                    <div 
                                      key={format}
                                      onClick={() => {
                                        setSelectedFormat(format);
                                        setShowFormatDropdown(false);
                                      }}
                                      className={`flex items-center space-x-2 px-3 py-2 rounded ${hoverBg} cursor-pointer ${selectedFormat === format ? 'text-blue-500' : ''}`}
                                    >
                                      <span>{format.toUpperCase()}</span>
                                      {selectedFormat === format && <Check size={16} />}
                                    </div>
                                  ))}
                                  
                                  <div className="my-1 border-t border-gray-700"></div>
                                  
                                  <div className="font-medium px-3 py-1 text-sm">Audio</div>
                                  {formats.audio.map(format => (
                                    <div 
                                      key={format}
                                      onClick={() => {
                                        setSelectedFormat(format);
                                        setShowFormatDropdown(false);
                                      }}
                                      className={`flex items-center justify-between px-3 py-2 rounded ${hoverBg} cursor-pointer ${selectedFormat === format ? 'text-blue-500' : ''}`}
                                    >
                                      <span>{format.toUpperCase()}</span>
                                      {selectedFormat === format && <Check size={16} />}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="relative">
                            <button 
                              onClick={() => setShowQualityDropdown(!showQualityDropdown)}
                              className={`flex items-center space-x-2 px-3 py-2 ${inputBg} border ${borderColor} rounded-lg`}
                            >
                              <span>Jakość: {selectedQuality}</span>
                              <ChevronDown size={16} />
                            </button>
                            
                            {showQualityDropdown && (
                              <div className={`absolute top-full right-0 mt-1 w-48 ${cardBg} border ${borderColor} rounded-lg shadow-xl z-10`}>
                                <div className="p-2">
                                  {(selectedFormat === 'mp3' || selectedFormat === 'aac' || selectedFormat === 'wav' || selectedFormat === 'ogg' || selectedFormat === 'flac' ? 
                                    qualities.audio : 
                                    qualities.video
                                  ).map(quality => (
                                    <div 
                                      key={quality}
                                      onClick={() => {
                                        setSelectedQuality(quality);
                                        setShowQualityDropdown(false);
                                      }}
                                      className={`flex items-center justify-between px-3 py-2 rounded ${hoverBg} cursor-pointer ${selectedQuality === quality ? 'text-blue-500' : ''}`}
                                    >
                                      <span>{quality}</span>
                                      {selectedQuality === quality && <Check size={16} />}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 mb-4">
                          <Folder size={18} className={secondaryTextColor} />
                          <span className="text-sm truncate">{downloadLocation}</span>
                          <button className={`px-2 py-1 text-xs ${cardBg} border ${borderColor} rounded`}>
                            Zmień
                          </button>
                        </div>
                        
                        <button 
                          onClick={handleDownload}
                          disabled={isDownloading}
                          className={`w-full py-3 bg-blue-600 text-white rounded-lg font-medium flex items-center justify-center space-x-2 hover:bg-blue-700 transition-colors ${isDownloading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isDownloading ? (
                            <>
                              <span>Pobieranie... {downloadProgress}%</span>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-2"></div>
                            </>
                          ) : (
                            <>
                              <Download size={18} />
                              <span>Pobierz</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-bold mb-4">Informacje o pliku</h3>
                      
                      <div className={`${cardBg} border ${borderColor} rounded-xl p-4`}>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className={`text-sm ${secondaryTextColor}`}>Tytuł</div>
                            <div className="font-medium">How to Design Professional UI in React</div>
                          </div>
                          <div>
                            <div className={`text-sm ${secondaryTextColor}`}>Kanał</div>
                            <div className="font-medium">UX Masters</div>
                          </div>
                          <div>
                            <div className={`text-sm ${secondaryTextColor}`}>Czas trwania</div>
                            <div className="font-medium">15:42</div>
                          </div>
                          <div>
                            <div className={`text-sm ${secondaryTextColor}`}>Dostępne rozdzielczości</div>
                            <div className="font-medium">4K, 1440p, 1080p, 720p, 480p</div>
                          </div>
                          <div>
                            <div className={`text-sm ${secondaryTextColor}`}>Szacowany rozmiar</div>
                            <div className="font-medium">245 MB (mp4, 1080p)</div>
                          </div>
                          <div>
                            <div className={`text-sm ${secondaryTextColor}`}>Opublikowano</div>
                            <div className="font-medium">25 maja 2025</div>
                          </div>
                        </div>
                        
                        <div className={`mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          <div className="flex items-start space-x-2">
                            <div className="mt-0.5">
                              <Check size={16} className="text-blue-500" />
                            </div>
                            <div>
                              <div className="font-medium">Kompatybilne z TubeDown Pro</div>
                              <div className="text-sm mt-1">Ten film można pobrać w wysokiej jakości bez ograniczeń</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-8">
                <h3 className="text-xl font-bold mb-4">Ostatnie pobrania</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  {downloadQueue.slice().reverse().slice(0, 6).map((item) => (
                    <div key={item.id} className={`${cardBg} border ${borderColor} rounded-xl overflow-hidden`}>
                      <div className="h-36 bg-gray-700 relative">
                        <img 
                          src={item.thumbnail} 
                          alt="Thumbnail" 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
                          {item.format.toUpperCase()}
                        </div>
                        {item.type === 'audio' && (
                          <div className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/70 flex items-center justify-center">
                            <Music size={16} className="text-white" />
                          </div>
                        )}
                      </div>
                      
                      <div className="p-3">
                        <div className="font-medium line-clamp-1">{item.title}</div>
                        <div className={`text-sm ${secondaryTextColor} mt-1`}>
                          {item.size} • {item.progress === 100 ? 'Pobrane' : `${item.progress}%`}
                        </div>
                        
                        {item.progress < 100 && (
                          <div className="w-full h-1 bg-gray-700 rounded-full mt-2">
                            <div 
                              className="h-full bg-blue-500 rounded-full" 
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'library' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Twoja biblioteka</h2>
              <p className="text-gray-500">Tutaj będzie wyświetlana zawartość biblioteki.</p>
            </div>
          )}
          
          {activeTab === 'history' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Historia pobrań</h2>
              <p className="text-gray-500">Tutaj będzie wyświetlana historia pobrań.</p>
            </div>
          )}
          
          {activeTab === 'settings' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Ustawienia</h2>
              <p className="text-gray-500">Tutaj będą wyświetlane ustawienia aplikacji.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}