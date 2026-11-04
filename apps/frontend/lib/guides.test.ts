import { describe, expect, it } from 'vitest';
import { linkedinUrlGuide } from './guides';

describe('linkedinUrlGuide', () => {
  it('points each device at its own public guide-videos object and poster', () => {
    expect(linkedinUrlGuide('mobile', 'https://project.supabase.test/')).toEqual({
      videoSrc: 'https://project.supabase.test/storage/v1/object/public/guide-videos/linkedin-url-mobile.mp4?v=1',
      posterSrc:
        'https://project.supabase.test/storage/v1/object/public/guide-videos/linkedin-url-mobile-poster.jpg?v=1',
    });
    expect(linkedinUrlGuide('desktop', 'https://project.supabase.test').videoSrc).toContain(
      '/linkedin-url-desktop.mp4'
    );
  });
});
