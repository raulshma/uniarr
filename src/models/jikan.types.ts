export interface JikanImageJpg {
  image_url?: string;
  small_image_url?: string;
  large_image_url?: string;
}

export interface JikanImages {
  jpg?: JikanImageJpg;
  webp?: Record<string, unknown> | undefined;
}

export interface JikanAnime {
  mal_id: number;
  url?: string;
  images?: JikanImages;
  title?: string;
  title_english?: string | null;
  title_japanese?: string | null;
  type?: string | null;
  episodes?: number | null;
  score?: number | null;
  synopsis?: string | null;
  aired?: { from?: string | null; to?: string | null } | null;
}

export interface JikanListResponse<T> {
  data: T[] | T;
  pagination?: {
    last_visible_page?: number;
    has_next_page?: boolean;
    items?: {
      count?: number;
      per_page?: number;
      total?: number;
    };
  };
}
