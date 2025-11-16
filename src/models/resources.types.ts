/**
 * Resources feature types for UniArr application
 * Provides comprehensive documentation, guides, and references for all supported services
 */

export type ResourceCategory =
  | "getting-started"
  | "service-guides"
  | "api-reference"
  | "troubleshooting"
  | "configuration"
  | "advanced-features";

export type ResourceType =
  | "guide"
  | "api-doc"
  | "tutorial"
  | "faq"
  | "troubleshooting"
  | "configuration"
  | "best-practices"
  | "video"
  | "external-link";

export type ServiceType =
  | "general"
  | "sonarr"
  | "radarr"
  | "lidarr"
  | "jellyseerr"
  | "qbittorrent"
  | "transmission"
  | "sabnzbd"
  | "deluge"
  | "prowlarr"
  | "jellyfin"
  | "bazarr"
  | "adguard"
  | "tmdb"
  | "homarr";

export interface ResourceLink {
  title: string;
  url: string;
  type: "internal" | "external";
  description?: string;
}

export interface ResourceSection {
  id: string;
  title: string;
  content: string;
  order: number;
  subsections?: ResourceSection[];
}

export interface Resource {
  id: string;
  title: string;
  description: string;
  category: ResourceCategory;
  type: ResourceType;
  service?: ServiceType;
  tags: string[];
  featured: boolean;
  order: number;
  lastUpdated: string;
  readTime?: number; // in minutes
  difficulty?: "beginner" | "intermediate" | "advanced";
  sections: ResourceSection[];
  links?: ResourceLink[];
  relatedResources?: string[]; // resource IDs
  prerequisites?: string[]; // resource IDs
  thumbnail?: string;
}

export interface ResourceFilter {
  category?: ResourceCategory;
  type?: ResourceType;
  service?: ServiceType;
  tags?: string[];
  featured?: boolean;
  difficulty?: string;
  searchQuery?: string;
}

export interface ResourceProgress {
  resourceId: string;
  completed: boolean;
  sectionsCompleted: string[]; // section IDs
  lastAccessed: string;
  timeSpent: number; // in minutes
}

export interface ResourceStats {
  totalResources: number;
  completedResources: number;
  totalTimeSpent: number; // in minutes
  categoryProgress: Record<
    ResourceCategory,
    {
      total: number;
      completed: number;
    }
  >;
  serviceProgress: Record<
    ServiceType,
    {
      total: number;
      completed: number;
    }
  >;
}

export interface ResourceBookmark {
  resourceId: string;
  sectionId?: string;
  created: string;
  note?: string;
}

// UI Component Props
export interface ResourceListItemProps {
  resource: Resource;
  onPress: (resource: Resource) => void;
  showProgress?: boolean;
  progress?: ResourceProgress;
}

export interface ResourceDetailScreenProps {
  resourceId: string;
}

export interface ResourcesScreenProps {
  initialCategory?: ResourceCategory;
  initialService?: ServiceType;
}

// Navigation types
export type ResourcesStackParamList = {
  "resources/index": undefined;
  "resources/[resourceId]": { resourceId: string };
  "resources/category/[category]": { category: ResourceCategory };
  "resources/service/[service]": { service: ServiceType };
};
