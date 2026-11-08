import { pdf } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import type { ArticleDto } from '@shared/article';
import { parseArticleHtml } from '@/lib/articles/html-blocks';
import { fileStem, loadImageAsPng, loadPdfLogo, publicSiteUrl, registerPdfFonts, saveBlob } from '@/lib/pdf/browser';
import { ArticlePdf } from './ArticlePdf';

// Client-only: builds the article PDF in the browser and saves it. Imported lazily from
// ArticleDownloadButton so none of this (or @react-pdf/renderer) is in the page bundle.
export async function downloadArticlePdf(article: ArticleDto): Promise<void> {
  registerPdfFonts();
  const articleUrl = publicSiteUrl(`/articles/${article.slug}`);

  const [qrDataUrl, logoDataUrl, authorPhotoDataUrl] = await Promise.all([
    QRCode.toDataURL(articleUrl, {
      errorCorrectionLevel: 'M',
      margin: 0,
      width: 240,
      color: { dark: '#0b0b0c', light: '#ffffff' },
    }),
    loadPdfLogo(),
    article.authorPhotoUrl ? loadImageAsPng(article.authorPhotoUrl, 120) : Promise.resolve(null),
  ]);

  const blob = await pdf(
    <ArticlePdf
      article={article}
      blocks={parseArticleHtml(article.body)}
      articleUrl={articleUrl}
      qrDataUrl={qrDataUrl}
      logoSrc={logoDataUrl}
      authorPhotoDataUrl={authorPhotoDataUrl}
      generatedAt={new Date()}
    />
  ).toBlob();

  saveBlob(blob, `${article.slug || fileStem(article.title)}-growxq.pdf`);
}
