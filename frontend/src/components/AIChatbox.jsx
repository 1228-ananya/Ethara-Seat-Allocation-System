import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, MessageSquare, Bot, User, CheckCircle2, AlertTriangle, ArrowRight, HelpCircle } from 'lucide-react';

export default function AIChatbox({ 
  onSendQuery, 
  onTriggerAction, // action executor callback
  loading 
}) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: "Hello! I am the Ethara AI Assistant. I can help you search, filter, allocate, and analyze seat allocations using natural language. Try clicking one of the suggested prompts below or type your own!",
      suggestedAction: null
    }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const suggestions = [
    "What is the seat utilization?",
    "Find available seats on floor 2",
    "Where is Rahul Nair sitting?",
    "Show unallocated new joiners",
    "Allocate seat F1-B005 to Pooja Patel",
    "Release seat F1-A015"
  ];

  const handleSubmit = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    // Add user message
    const userMsg = { id: Date.now(), sender: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    
    if (!textToSend) setInput('');

    try {
      const response = await onSendQuery(text);
      
      // Add bot response
      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: response.response_text,
        suggestedAction: response.suggested_action,
        data: response.data
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: "I encountered an error querying the assistant server. Please check that the backend is running.",
          isError: true
        }
      ]);
    }
  };

  const handleActionClick = (action) => {
    // Call the parent handler to execute this action
    onTriggerAction(action);
  };

  return (
    <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col justify-between">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-ethara-border pb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-400" />
            AI Query Assistant
          </h2>
          <p className="text-sm text-ethara-muted font-medium">Interact with your seat directories and allocation logs using plain English.</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-1 py-4 space-y-4 min-h-[300px]">
        {messages.map((msg) => {
          const isBot = msg.sender === 'bot';
          return (
            <div key={msg.id} className={`flex gap-3 max-w-[85%] ${isBot ? '' : 'ml-auto flex-row-reverse'}`}>
              {/* Avatar */}
              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border ${
                isBot 
                  ? 'bg-blue-600/10 border-blue-500/20 text-blue-400' 
                  : 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400'
              }`}>
                {isBot ? <Bot className="h-4.5 w-4.5" /> : <User className="h-4.5 w-4.5" />}
              </div>

              {/* Message Bubble */}
              <div className="space-y-2">
                <div className={`p-4 rounded-2xl text-xs leading-relaxed ${
                  isBot 
                    ? msg.isError 
                      ? 'bg-red-500/10 border border-red-500/20 text-red-400 font-semibold'
                      : 'bg-ethara-card border border-ethara-border text-gray-200' 
                    : 'bg-blue-600 text-white shadow-lg shadow-blue-600/15'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>

                {/* Suggested Action Attachment */}
                {isBot && msg.suggestedAction && (
                  <div className="bg-[#0E1321] border border-blue-500/20 rounded-xl p-3.5 space-y-3 shadow-lg max-w-sm">
                    <div className="flex items-center gap-2 text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Suggested Command Action</span>
                    </div>

                    <p className="text-xs text-gray-300 font-medium">
                      {msg.suggestedAction.type === 'allocate' && `Confirm allocating seat ${msg.suggestedAction.params.seat_number} to ${msg.suggestedAction.params.employee_name}?`}
                      {msg.suggestedAction.type === 'release' && `Confirm releasing occupant from seat ${msg.suggestedAction.params.seat_number}?`}
                      {msg.suggestedAction.type === 'filter_seats' && `Inspect Floor ${msg.suggestedAction.params.floor} available layout map?`}
                      {msg.suggestedAction.type === 'view_employee' && `Locate and view details of employee?`}
                      {msg.suggestedAction.type === 'view_project' && `Locate and view project details?`}
                      {msg.suggestedAction.type === 'view_dashboard' && `Switch to executive analytics dashboard?`}
                    </p>

                    <button
                      onClick={() => handleActionClick(msg.suggestedAction)}
                      className="flex items-center justify-between w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold transition-all shadow shadow-blue-500/10"
                    >
                      <span>Execute Action</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex gap-3 max-w-[80%]">
            <div className="h-8 w-8 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Bot className="h-4.5 w-4.5 animate-pulse" />
            </div>
            <div className="bg-ethara-card border border-ethara-border p-4 rounded-2xl text-xs text-ethara-muted flex items-center gap-2">
              <div className="h-2 w-2 bg-blue-500 rounded-full animate-ping"></div>
              <span>Analyzing intent and querying database...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box and Suggestions */}
      <div className="space-y-3 border-t border-ethara-border pt-4 shrink-0 bg-[#0B0F19]">
        {/* Suggestion Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSubmit(s)}
              disabled={loading}
              className="px-3 py-1.5 bg-[#161D30]/40 border border-ethara-border hover:border-blue-500/40 text-ethara-muted hover:text-white rounded-xl text-[10px] font-semibold transition-all shrink-0 cursor-pointer disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Ask a question or request a seating change..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3 bg-[#161D30] border border-ethara-border focus:border-blue-500 text-white text-xs rounded-xl focus:outline-none placeholder-ethara-muted"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white rounded-xl transition-all shadow-md shadow-blue-500/10"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
