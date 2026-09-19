'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

/**
 * Sanitisation runs after highlighting and KaTeX so their markup survives, while
 * anything the model emitted is still stripped of scripts, handlers and javascript: URLs.
 */
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] || []), 'className', 'style'],
    span: [...(defaultSchema.attributes?.span || []), 'className', 'style', 'ariaHidden'],
    code: [...(defaultSchema.attributes?.code || []), 'className'],
  },
  protocols: { ...defaultSchema.protocols, href: ['http', 'https', 'mailto'], src: ['http', 'https'] },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'math', 'semantics', 'annotation', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'msqrt', 'mtext', 'mspace',
  ],
};

const components = {
  a: (props) => <a {...props} target="_blank" rel="noopener noreferrer nofollow" />,
  table: (props) => (
    <div className="table-wrap">
      <table {...props} />
    </div>
  ),
};

export function Markdown({ children, className = '' }) {
  return (
    <div className={`prose ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, [rehypeKatex, { throwOnError: false }], [rehypeSanitize, schema]]}
        components={components}
      >
        {children || ''}
      </ReactMarkdown>
    </div>
  );
}
