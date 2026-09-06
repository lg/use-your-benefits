import { useId, useState } from 'react';
import { AgentDownloadInstructions } from './AgentDownloadInstructions';

interface DownloadInstructionsProps {
  bank: 'Chase' | 'Amex';
  cardName: string;
  cardId: string;
}

export function DownloadInstructions({ bank, cardName, cardId }: DownloadInstructionsProps) {
  const [method, setMethod] = useState<'manual' | 'agent'>('agent');
  const tabsId = useId();
  const activityUrl = bank === 'Chase'
    ? 'https://secure.chase.com/web/auth/dashboard#/dashboard/overviewAccounts/transactions/gwmAccounts'
    : 'https://global.americanexpress.com/activity';

  return (
    <div className="mb-4">
      <div className="mb-4 flex border-b border-slate-600" role="tablist" aria-label="Download instructions">
        {(['agent', 'manual'] as const).map(option => (
          <button
            key={option}
            type="button"
            role="tab"
            id={`${tabsId}-${option}`}
            aria-selected={method === option}
            aria-controls={`${tabsId}-panel`}
            tabIndex={method === option ? 0 : -1}
            onClick={() => setMethod(option)}
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === 'Home' ? 'agent' : event.key === 'End' ? 'manual' : option === 'agent' ? 'manual' : 'agent';
              setMethod(next);
              document.getElementById(`${tabsId}-${next}`)?.focus();
            }}
            className={`-mb-px flex-1 border-b-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 sm:flex-none ${method === option
              ? 'border-blue-500 text-white'
              : 'border-transparent text-slate-400 hover:border-slate-500 hover:text-white'}`}
          >
            {option === 'manual' ? 'Download manually' : 'Use an LLM agent'}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${method}`} tabIndex={0}>
      {method === 'agent' ? (
        <AgentDownloadInstructions bank={bank} cardName={cardName} cardId={cardId} />
      ) : (
        <div className="rounded-lg border border-slate-600 bg-slate-900/50 p-4 text-sm">
          <p className="mb-2 font-medium text-slate-200">How to export from {bank}</p>
          <ol className="list-decimal space-y-2 pl-5 text-slate-300">
            <li>
              Open your{' '}
              <a href={activityUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">
                {bank} account activity
              </a>{' '}
              and sign in.
            </li>
            {bank === 'Chase' ? (
              <>
                <li>Select your {cardName} in the “Showing” dropdown.</li>
                <li>Set the date range to “Year to date,” or use Search to select a longer period.</li>
                <li>Click the download icon and choose <strong>CSV</strong>.</li>
              </>
            ) : (
              <>
                <li>Select your {cardName} and the year or date range you want to import.</li>
                <li>Click Download, choose <strong>CSV</strong>, and select <strong>“Include all additional transaction details.”</strong></li>
                <li>Click Download to save the file.</li>
              </>
            )}
            <li>Save the CSV in Downloads, then drag it below or click <strong>Choose File</strong>.</li>
          </ol>
        </div>
      )}
      </div>
    </div>
  );
}
