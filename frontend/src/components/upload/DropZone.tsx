import { useCallback, useState } from 'react';
import { Upload, FileUp, Loader2, Sparkles } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useProject } from '../../hooks/useProject';

const ACCEPTED = '.pdf,.docx,.doc,.pptx,.xlsx,.xls,.drawio,.xml,.txt,.md,.png,.jpg,.jpeg,.svg,.webp';

export function DropZone() {
  const { uploading, documents } = useStore();
  const { uploadFiles } = useProject();
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) await uploadFiles(files);
    },
    [uploadFiles],
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length) await uploadFiles(files);
      e.target.value = '';
    },
    [uploadFiles],
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`w-full max-w-2xl border-2 border-dashed rounded-3xl p-20 text-center transition-all cursor-pointer relative overflow-hidden ${
          dragOver
            ? 'border-indigo-400/60 bg-indigo-500/[0.06] scale-[1.02]'
            : 'border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.01]'
        }`}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        {/* Subtle background glow on drag */}
        {dragOver && (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-transparent pointer-events-none" />
        )}

        {uploading ? (
          <div className="flex flex-col items-center gap-5 relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
            <div>
              <p className="text-lg text-gray-200 font-medium">Processing files...</p>
              <p className="text-sm text-gray-500 mt-1">Parsing and chunking your documents</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 relative">
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all ${
              dragOver
                ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 scale-110'
                : 'bg-gradient-to-br from-indigo-500/10 to-purple-500/10'
            }`}>
              {dragOver ? (
                <FileUp className="w-9 h-9 text-indigo-400" />
              ) : (
                <Upload className="w-9 h-9 text-indigo-400/80" />
              )}
            </div>
            <div>
              <p className="text-xl text-gray-200 font-semibold">
                Drop your project documents
              </p>
              <p className="text-sm text-gray-500 mt-2">
                PDF, DOCX, PPTX, XLSX, Draw.io, TXT, Markdown, Images
              </p>
            </div>
            <button className="mt-1 px-8 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-gray-400 hover:bg-white/[0.07] hover:text-gray-300 hover:border-white/[0.12] transition-all">
              Browse Files
            </button>
          </div>
        )}
        <input
          id="file-input"
          type="file"
          multiple
          accept={ACCEPTED}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {documents.length > 0 && (
        <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500/50" />
          {documents.length} document{documents.length !== 1 ? 's' : ''} uploaded — ready to analyze
        </div>
      )}
    </div>
  );
}
