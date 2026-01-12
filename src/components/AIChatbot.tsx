import { useState, useRef, useEffect } from 'react';
import { 
  MessageCircle, X, Send, Loader2, Bot, User, Sparkles, 
  Search, Trash2, ExternalLink, AlertTriangle, ChevronDown,
  Wrench, Building2, Globe
} from 'lucide-react';
import { Card, CardBody, Button, Input, Badge } from '@/components/ui';
import { 
  chatWithAssistant, 
  clearConversation, 
  getConversationHistory,
  getDiagnostic,
  type ChatMessage,
  type DiagnosticResult
} from '@/services/aiService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AIChatbotProps {
  defaultAscenseur?: string;
}

export function AIChatbot({ defaultAscenseur }: AIChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [codeAppareil, setCodeAppareil] = useState(defaultAscenseur || '');
  const [includeWebSearch, setIncludeWebSearch] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Charger l'historique au montage
  useEffect(() => {
    const history = getConversationHistory(sessionId);
    if (history.length > 0) {
      setMessages(history);
    }
  }, [sessionId]);

  // Scroll vers le bas à chaque nouveau message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus sur l'input quand on ouvre
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setMessage('');
    
    // Ajouter le message utilisateur
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage, 
      timestamp: new Date() 
    }]);
    
    setIsLoading(true);

    try {
      const result = await chatWithAssistant(userMessage, sessionId, {
        codeAppareil: codeAppareil || undefined,
        includeWebSearch
      });

      // Ajouter la réponse
      let responseContent = result.response;
      
      // Ajouter les sources web si présentes
      if (result.sources && result.sources.length > 0) {
        responseContent += '\n\n---\n📚 **Sources:**\n';
        result.sources.forEach(s => {
          responseContent += `- [${s.titre}](${s.url})\n`;
        });
      }

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: responseContent, 
        timestamp: new Date() 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '❌ Désolé, une erreur est survenue. Veuillez réessayer.', 
        timestamp: new Date() 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    clearConversation(sessionId);
    setMessages([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Suggestions rapides
  const suggestions = [
    { text: 'Code erreur E45', icon: AlertTriangle },
    { text: 'Bruit métallique cabine', icon: Wrench },
    { text: 'Porte qui se bloque', icon: Building2 },
    { text: 'Procédure Otis Gen2', icon: Sparkles },
  ];

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all z-40 flex items-center justify-center ${
          isOpen ? 'scale-0' : 'scale-100'
        }`}
      >
        <Bot className="w-7 h-7" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
      </button>

      {/* Fenêtre de chat */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[420px] h-[600px] bg-[var(--bg-secondary)] rounded-2xl shadow-2xl border border-[var(--border-primary)] flex flex-col z-50 overflow-hidden">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold">Assistant Technique IA</h3>
                  <p className="text-xs text-white/80">Diagnostic • Codes erreur • Procédures</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="Paramètres"
                >
                  <ChevronDown className={`w-5 h-5 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                </button>
                <button
                  onClick={handleClear}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="Effacer la conversation"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Paramètres */}
            {showSettings && (
              <div className="mt-3 pt-3 border-t border-white/20 space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  <input
                    type="text"
                    value={codeAppareil}
                    onChange={e => setCodeAppareil(e.target.value)}
                    placeholder="Code ascenseur (optionnel)"
                    className="flex-1 px-2 py-1 bg-white/20 rounded text-sm placeholder:text-white/50 outline-none"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeWebSearch}
                    onChange={e => setIncludeWebSearch(e.target.checked)}
                    className="rounded"
                  />
                  <Globe className="w-4 h-4" />
                  Rechercher sur le web
                </label>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <Bot className="w-16 h-16 mx-auto mb-4 text-purple-500 opacity-50" />
                <h4 className="font-semibold mb-2">Comment puis-je vous aider ?</h4>
                <p className="text-sm text-[var(--text-muted)] mb-6">
                  Posez-moi vos questions techniques sur les ascenseurs
                </p>
                
                {/* Suggestions */}
                <div className="space-y-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setMessage(s.text);
                        inputRef.current?.focus();
                      }}
                      className="w-full flex items-center gap-2 p-3 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-primary)] transition-colors text-left text-sm"
                    >
                      <s.icon className="w-4 h-4 text-purple-400" />
                      {s.text}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                    msg.role === 'user' 
                      ? 'bg-blue-500/20' 
                      : 'bg-purple-500/20'
                  }`}>
                    {msg.role === 'user' 
                      ? <User className="w-4 h-4 text-blue-400" />
                      : <Bot className="w-4 h-4 text-purple-400" />
                    }
                  </div>
                  <div className={`flex-1 max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block p-3 rounded-2xl text-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white rounded-br-sm'
                        : 'bg-[var(--bg-tertiary)] rounded-bl-sm'
                    }`}>
                      {msg.role === 'assistant' ? (
                        <div 
                          className="prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ 
                            __html: formatMessage(msg.content) 
                          }}
                        />
                      ) : (
                        msg.content
                      )}
                    </div>
                    {msg.timestamp && (
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">
                        {format(new Date(msg.timestamp), 'HH:mm', { locale: fr })}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-purple-400" />
                </div>
                <div className="bg-[var(--bg-tertiary)] rounded-2xl rounded-bl-sm p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    <span className="text-sm text-[var(--text-muted)]">Analyse en cours...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-[var(--border-primary)]">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Décrivez votre problème..."
                className="flex-1 px-4 py-3 bg-[var(--bg-tertiary)] rounded-xl outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!message.trim() || isLoading}
                className="px-4 py-3 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] text-center mt-2">
              IA expérimentale • Toujours vérifier les recommandations
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Formater le message markdown en HTML
 */
function formatMessage(content: string): string {
  return content
    // Headers
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Listes
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    // Code inline
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-black/20 rounded text-xs">$1</code>')
    // Liens
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" class="text-purple-400 hover:underline">$1</a>')
    // Emojis et séparateurs
    .replace(/---/g, '<hr class="my-2 border-[var(--border-primary)]">')
    // Sauts de ligne
    .replace(/\n/g, '<br>');
}

/**
 * Composant Assistant Diagnostic (version modale)
 */
export function DiagnosticAssistant({ 
  onClose, 
  defaultAscenseur 
}: { 
  onClose: () => void;
  defaultAscenseur?: string;
}) {
  const [step, setStep] = useState(1);
  const [symptomes, setSymptomes] = useState<string[]>([]);
  const [codeErreur, setCodeErreur] = useState('');
  const [marque, setMarque] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  const symptomesOptions = [
    { id: 'bruit_metallique', label: 'Bruit métallique', icon: '🔊' },
    { id: 'vibrations', label: 'Vibrations anormales', icon: '📳' },
    { id: 'arret_brusque', label: 'Arrêt brusque', icon: '⛔' },
    { id: 'porte_bloque', label: 'Porte bloquée', icon: '🚪' },
    { id: 'lenteur', label: 'Lenteur', icon: '🐢' },
    { id: 'a_coups', label: 'À-coups', icon: '↕️' },
  ];

  const marques = ['Otis', 'Schindler', 'Kone', 'ThyssenKrupp', 'Mitsubishi', 'Autre'];

  const handleDiagnostic = async () => {
    setIsLoading(true);
    try {
      const diagnostic = await getDiagnostic(
        symptomes,
        defaultAscenseur,
        codeErreur || undefined,
        marque || undefined
      );
      setResult(diagnostic);
      setStep(3);
    } catch (error) {
      console.error('Erreur diagnostic:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-[600px] max-h-[80vh] overflow-hidden">
        <CardBody className="p-0">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-orange-500 to-red-500 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6" />
                <div>
                  <h2 className="font-bold text-lg">Assistant Diagnostic IA</h2>
                  <p className="text-sm text-white/80">Étape {step}/3</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {/* Étape 1: Symptômes */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Quels symptômes observez-vous ?</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {symptomesOptions.map(s => (
                      <button
                        key={s.id}
                        onClick={() => {
                          if (symptomes.includes(s.id)) {
                            setSymptomes(symptomes.filter(x => x !== s.id));
                          } else {
                            setSymptomes([...symptomes, s.id]);
                          }
                        }}
                        className={`p-3 rounded-lg border-2 transition-all text-left flex items-center gap-2 ${
                          symptomes.includes(s.id)
                            ? 'border-orange-500 bg-orange-500/10'
                            : 'border-[var(--border-primary)] hover:border-[var(--text-muted)]'
                        }`}
                      >
                        <span className="text-xl">{s.icon}</span>
                        <span className="text-sm">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-[var(--text-muted)] mb-1 block">
                    Code erreur affiché (optionnel)
                  </label>
                  <Input
                    value={codeErreur}
                    onChange={e => setCodeErreur(e.target.value.toUpperCase())}
                    placeholder="Ex: E45, F12..."
                  />
                </div>

                <div>
                  <label className="text-sm text-[var(--text-muted)] mb-1 block">
                    Description libre (optionnel)
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Décrivez le problème avec vos mots..."
                    className="w-full p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-primary)] outline-none focus:ring-2 focus:ring-orange-500/50 resize-none h-20"
                  />
                </div>

                <Button 
                  variant="primary" 
                  className="w-full"
                  onClick={() => setStep(2)}
                  disabled={symptomes.length === 0 && !codeErreur && !description}
                >
                  Continuer
                </Button>
              </div>
            )}

            {/* Étape 2: Contexte */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Informations complémentaires</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-[var(--text-muted)] mb-1 block">
                        Marque de l'ascenseur
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {marques.map(m => (
                          <button
                            key={m}
                            onClick={() => setMarque(marque === m ? '' : m)}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                              marque === m
                                ? 'bg-orange-500 text-white'
                                : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)]'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setStep(1)}>
                    Retour
                  </Button>
                  <Button 
                    variant="primary" 
                    className="flex-1"
                    onClick={handleDiagnostic}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Analyse en cours...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Lancer le diagnostic
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Étape 3: Résultats */}
            {step === 3 && result && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Causes probables
                  </h3>
                  <div className="space-y-2">
                    {result.causesProbables.map((cause, i) => (
                      <div 
                        key={i}
                        className="p-3 bg-[var(--bg-tertiary)] rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{cause.cause}</span>
                          <Badge variant={cause.probabilite > 70 ? 'red' : cause.probabilite > 40 ? 'orange' : 'gray'}>
                            {cause.probabilite}%
                          </Badge>
                        </div>
                        <p className="text-sm text-[var(--text-muted)]">{cause.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-400">{result.tempsEstime} min</p>
                    <p className="text-xs text-[var(--text-muted)]">Temps estimé</p>
                  </div>
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg text-center">
                    <p className="text-2xl font-bold capitalize text-orange-400">{result.difficulte}</p>
                    <p className="text-xs text-[var(--text-muted)]">Difficulté</p>
                  </div>
                </div>

                {result.sourceWeb && result.sourceWeb.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Ressources web
                    </h4>
                    <div className="space-y-1">
                      {result.sourceWeb.map((s, i) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)] rounded text-sm hover:bg-[var(--bg-primary)] transition-colors"
                        >
                          <ExternalLink className="w-3 h-3 text-blue-400" />
                          {s.titre}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => { setStep(1); setResult(null); }}>
                    Nouveau diagnostic
                  </Button>
                  <Button variant="primary" className="flex-1" onClick={onClose}>
                    Fermer
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
