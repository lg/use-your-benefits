import { useState } from 'react';

interface AgentDownloadInstructionsProps {
  bank: 'Chase' | 'Amex';
  cardName: string;
  cardId: string;
}

function PromptParagraph({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\(https:\/\/[^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g);

  return (
    <p>
      {parts.map((part, index) => {
        const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^)]+)\)$/);
        if (link) {
          return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline decoration-blue-400/40 underline-offset-2 hover:text-blue-300">{link[1]}</a>;
        }
        if (part.startsWith('**')) {
          return <strong key={index} className="font-semibold text-slate-100">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`')) {
          return <code key={index} className="rounded bg-slate-800 px-1.5 py-0.5 text-[0.85em] text-blue-200">{part.slice(1, -1)}</code>;
        }
        return part;
      })}
    </p>
  );
}

export function AgentDownloadInstructions({ bank, cardName, cardId }: AgentDownloadInstructionsProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const today = new Date().toISOString().slice(0, 10);
  const prompt = bank === 'Amex'
    ? `Use the default browser to open [https://global.americanexpress.com/activity](https://global.americanexpress.com/activity) and select my personal American Express Platinum. If sign-in is needed, use 1Password or my local password manager. Ask for help if login, MFA, or card selection needs it.
Download all available **posted transactions from the past two years through today**, including purchases, payments, refunds, and credits. Use the available year presets or non-overlapping date ranges. Choose **CSV** and **“Include all additional transaction details.”**
Combine exports with a CSV parser into one file with a single header, preserving every transaction, original field, multiline value, and amount sign. Verify the Date, Description, Amount, Extended Details, and Reference columns.
Save in my computer’s **Downloads folder** as \`amex-platinum-YYYY-MM-DD.csv\`, using today’s date and a numeric suffix if needed. Verify the saved file and report its full path, transaction count, actual date range, and any unavailable history. Leave it for me to upload manually.`
    : `Use your browser tools to download my ${cardName} account activity as a CSV for Use Your Benefits.

Open [Chase account activity](https://secure.chase.com/web/auth/dashboard#/dashboard/overviewAccounts/transactions/gwmAccounts). Select my ${cardName} in the Showing dropdown. Use the date range controls or Search to retrieve the widest available history, then use the download icon and choose **CSV**. Preserve the Transaction Date, Description, Amount, and Type columns, including Adjustment transactions.

Pause for me to sign in or complete MFA if needed. If more than one account matches this card, ask me which to use.

Export all available posted transaction history through ${today}, including the full current calendar year and any earlier history available. Include purchases, payments, refunds, and statement credits. Keep the original column names, descriptions, dates, and amount signs.

If the bank limits the export range, download non-overlapping date ranges and combine them into one valid CSV with a single header row. Preserve quoted fields, multiline values, and every transaction row. Report any history you cannot retrieve.

Save the final file as \`${cardId}-${today}.csv\` in the **Downloads directory** on my computer. If that filename already exists, add a numeric suffix. Verify the file exists there and contains CSV transaction data with the columns listed above.

Tell me the full file path and the date range downloaded. Leave the CSV in Downloads for me to upload to Use Your Benefits manually.`;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-slate-600 bg-slate-900/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-200">Download with an agent</p>
        <button
          type="button"
          onClick={copyPrompt}
          className="btn-primary text-sm"
          aria-label={`Copy ${bank} download prompt`}
        >
          <span aria-live="polite">{copyStatus === 'copied' ? 'Copied' : 'Copy prompt'}</span>
        </button>
      </div>
      <p className="mt-2 text-sm text-slate-400">
        Give this prompt to an agent with browser access, then upload the CSV from Downloads below.
      </p>
      {copyStatus === 'error' && (
        <p role="status" className="mt-2 text-sm text-amber-300">
          Could not copy. Open the prompt below to select and copy it manually.
        </p>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-slate-400 hover:text-slate-200">
          View prompt
        </summary>
        <div
          role="region"
          aria-label={`${bank} download prompt`}
          className="mt-3 space-y-4 rounded-lg border border-slate-700 bg-slate-950/40 p-4 text-sm leading-7 text-slate-300 [overflow-wrap:anywhere] select-text"
        >
          {prompt.split(/\n+/).map((paragraph, index) => (
            <PromptParagraph key={index} text={paragraph} />
          ))}
        </div>
      </details>
    </div>
  );
}
