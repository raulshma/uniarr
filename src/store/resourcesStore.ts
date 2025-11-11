/**
 * Resources Store - Comprehensive documentation and guides for UniArr
 * Manages educational content, troubleshooting guides, and service documentation
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { storageAdapter } from "@/services/storage/StorageAdapter";
import type {
  Resource,
  ResourceFilter,
  ResourceProgress,
  ResourceStats,
  ResourceBookmark,
  ResourceCategory,
  ServiceType,
} from "@/models/resources.types";

interface ResourcesState {
  // Data
  resources: Resource[];
  progress: Record<string, ResourceProgress>;
  bookmarks: ResourceBookmark[];
  favorites: string[]; // resource IDs of favorited resources
  viewCount: Record<string, number>; // track how many times a resource was viewed

  // UI State
  selectedCategory: ResourceCategory | undefined;
  selectedService: ServiceType | undefined;
  searchQuery: string;
  showFeaturedOnly: boolean;
  viewPreference: "compact" | "expanded"; // for detail view

  // Computed
  getFilteredResources: (filter?: Partial<ResourceFilter>) => Resource[];
  getResourceById: (id: string) => Resource | undefined;
  getProgressForResource: (resourceId: string) => ResourceProgress | undefined;
  getStats: () => ResourceStats;
  getBookmarksForResource: (resourceId: string) => ResourceBookmark[];
  getFavoriteResources: () => Resource[];
  getRelatedResources: (resourceId: string) => Resource[];

  // Actions
  updateProgress: (
    resourceId: string,
    progress: Partial<ResourceProgress>,
  ) => void;
  markSectionCompleted: (resourceId: string, sectionId: string) => void;
  markResourceCompleted: (resourceId: string) => void;
  addBookmark: (resourceId: string, sectionId?: string, note?: string) => void;
  removeBookmark: (resourceId: string, sectionId?: string) => void;
  toggleFavorite: (resourceId: string) => void;
  isFavorited: (resourceId: string) => boolean;
  incrementViewCount: (resourceId: string) => void;
  setFilter: (filter: {
    category?: ResourceCategory;
    service?: ServiceType;
    searchQuery?: string;
    showFeaturedOnly?: boolean;
  }) => void;
  setViewPreference: (preference: "compact" | "expanded") => void;
  resetProgress: () => void;
}

// Sample resources data - comprehensive documentation for UniArr
const sampleResources: Resource[] = [
  // Getting Started
  {
    id: "getting-started-uniarr",
    title: "Getting Started with UniArr",
    description:
      "Complete guide to setting up and using UniArr for media management",
    category: "getting-started",
    type: "guide",
    service: "general",
    tags: ["setup", "introduction", "basics"],
    featured: true,
    order: 1,
    lastUpdated: "2024-01-15T10:00:00Z",
    readTime: 15,
    difficulty: "beginner",
    sections: [
      {
        id: "intro",
        title: "Welcome to UniArr",
        content: `# Welcome to UniArr

UniArr is your unified dashboard for managing media across multiple services. It brings together Sonarr, Radarr, Jellyseerr, qBittorrent, and more into a single, beautiful interface that works seamlessly on mobile devices.

## What You Can Do With UniArr

- Monitor all your media services in one place
- Manage downloads and queues
- Request new content through Jellyseerr
- View your media calendar and upcoming releases
- Configure and troubleshoot services with ease

Let's get you started with the basics!`,
        order: 1,
      },
      {
        id: "first-setup",
        title: "Initial Setup",
        content: `# Initial Setup

Setting up UniArr is straightforward:

## Setup Steps

1. **Install the App**: Download from your app store or build from source
2. **Create Account**: Sign up using your preferred authentication method
3. **Add Services**: Connect your existing Sonarr, Radarr, and other services
4. **Configure Settings**: Set your preferences for themes, notifications, and more

## Service Requirements

Each service needs:
- Service URL (e.g., http://localhost:8989 for Sonarr)
- API key (find this in your service settings)
- Optional authentication credentials

> **Pro tip**: Use the "Test Connection" feature to verify each service before saving!`,
        order: 2,
      },
      {
        id: "navigation",
        title: "Navigation Overview",
        content: `# Navigation Overview

UniArr uses a tab-based interface for easy navigation:

## Main Tabs

- **Dashboard**: Your home screen with service status and quick actions
- **Services**: Manage and monitor all connected services
- **Recently Added**: View newly added media across all services
- **Downloads**: Monitor qBittorrent downloads and queue management
- **Settings**: Configure app preferences, services, and advanced options

Swipe between tabs or use the bottom navigation bar. Each tab provides specialized tools for managing different aspects of your media setup.`,
        order: 3,
      },
      {
        id: "next-steps",
        title: "Next Steps",
        content: `# Next Steps

Now that you're familiar with the basics, explore these features:

## Advanced Features

- **Widget System**: Customize your dashboard with widgets
- **Release Calendar**: Track upcoming TV episodes and movie releases
- **Voice Assistant**: Set up Siri/Google Assistant integration
- **Offline Mode**: Access your content even without internet
- **Backup & Restore**: Keep your settings and data safe

Check out our advanced guides for power-user features and troubleshooting!`,
        order: 4,
      },
    ],
    links: [
      {
        title: "Service Setup Guides",
        url: "resources/category/service-guides",
        type: "internal",
        description: "Detailed guides for each supported service",
      },
      {
        title: "UniArr GitHub",
        url: "https://github.com/your-repo/uniarr",
        type: "external",
        description: "Source code and documentation",
      },
    ],
  },
  {
    id: "service-overview",
    title: "Supported Services Overview",
    description:
      "Complete list of services supported by UniArr and their capabilities",
    category: "getting-started",
    type: "guide",
    service: "general",
    tags: ["services", "overview", "compatibility"],
    featured: true,
    order: 2,
    lastUpdated: "2024-01-20T14:30:00Z",
    readTime: 10,
    difficulty: "beginner",
    sections: [
      {
        id: "media-management",
        title: "Media Management Services",
        content: `# Media Management Services

UniArr integrates with popular media management tools:

## Sonarr: TV Show Management

- Automatically downloads TV episodes
- Quality profiles and upgrade rules
- Series monitoring and automatic discovery

## Radarr: Movie Management

- Automatic movie downloads
- Custom quality profiles
- Release profile management

## Jellyseerr: Media Requests

- User request system
- Approval workflows
- Notification integration`,
        order: 1,
      },
      {
        id: "download-services",
        title: "Download Services",
        content: `# Download Services

Download management capabilities:

## qBittorrent: Torrent Downloads

- Complete queue management
- Speed limits and throttling
- RSS feed support

## Prowlarr: Indexer Management

- Multiple indexer support
- API key management
- Search capabilities`,
        order: 2,
      },
      {
        id: "media-servers",
        title: "Media Servers",
        content: `# Media Servers

Media server integration:

## Jellyfin: Media Organization

- Library management
- Transcoding support
- User management

## Bazarr: Subtitle Management

- Automatic subtitle downloads
- Multiple language support
- Integration with Sonarr/Radarr`,
        order: 3,
      },
      {
        id: "additional-services",
        title: "Additional Services",
        content: `# Additional Services

Enhancement and integration services:

## Lidarr: Music Management

- Automatic music downloads
- Artist and album monitoring
- Quality profile management for audio
- Music library organization
- Metadata and tagging support

## Bazarr: Subtitle Management

- Automatic subtitle downloads
- Multi-language support
- Integration with Sonarr/Radarr
- Custom subtitle providers
- Quality and scoring management

## Prowlarr: Indexer Management

- Centralized torrent/Usenet indexer management
- Proxy functionality for media managers
- 1000+ tracker and indexer support
- Advanced filtering and tagging
- RSS feed generation

## AdGuard Home: Network-Level Ad Blocking

- Network-wide DNS filtering
- Custom blocklists and allowlists
- Encrypted DNS support (DoH, DoT)
- Parental controls and safe browsing
- Device management and statistics

## TMDB: Media Metadata API

- Comprehensive movie and TV database
- Rich metadata and images
- Search and discovery features
- Watch provider integration
- Multi-language support

## Additional Download Clients

### Transmission
- Lightweight torrent client
- RPC interface for remote management
- Bandwidth scheduling
- Protocol encryption

### SABnzbd
- Usenet binary newsreader
- Automatic repair and unpack
- Web-based interface
- Post-processing automation

### Deluge
- Plugin-based torrent client
- Multiple user interfaces
- JSON-RPC API support
- Advanced configuration options`,
        order: 4,
      },
    ],
  },
  // Service Guides - Media Management Services
  {
    id: "lidarr-setup-guide",
    title: "Lidarr Music Management Setup",
    description:
      "Complete guide to setting up Lidarr with UniArr for music library management",
    category: "service-guides",
    type: "guide",
    service: "lidarr",
    tags: ["lidarr", "music", "artists", "albums", "setup"],
    featured: true,
    order: 13,
    lastUpdated: "2024-01-23T14:00:00Z",
    readTime: 22,
    difficulty: "intermediate",
    sections: [
      {
        id: "lidarr-intro",
        title: "Introduction to Lidarr",
        content: `# Introduction to Lidarr

Lidarr is a music collection manager for Usenet and BitTorrent users, designed to automate music download and organization.

## Key Features

- Automatic music downloads from various sources
- Quality profile management for audio formats
- Artist and album monitoring
- Metadata enrichment and tagging
- Integration with music libraries and players
- Support for multiple audio formats (FLAC, MP3, AAC, etc.)

## Use Cases

- Building comprehensive music libraries
- Automating music collection management
- Maintaining high-quality audio archives
- Artist discography completion
- Music format upgrades and organization`,
        order: 1,
      },
      {
        id: "lidarr-setup",
        title: "Lidarr Setup and Configuration",
        content: `# Lidarr Setup and Configuration

## Prerequisites

- Lidarr v1.0 or later installed and running
- Administrator access to Lidarr interface
- Lidarr accessible from your mobile device
- API key available from Lidarr settings

## Finding Your API Key

1. Open Lidarr web interface (usually http://localhost:8686)
2. Navigate to Settings → General
3. Look for "API Key" in the Security section
4. Copy the API key for UniArr configuration

## Connecting to UniArr

1. Open UniArr and go to Services tab
2. Tap "Add Service" and select "Lidarr"
3. Enter your Lidarr URL (e.g., http://192.168.1.100:8686)
4. Paste your API key
5. Configure optional settings:
   - Service display name
   - Notification preferences
   - Refresh intervals
6. Test the connection
7. Save configuration

## Quality Profiles

Lidarr quality profiles determine audio format preferences:
- **Lossless**: FLAC, ALAC, WAV
- **Lossy**: MP3, AAC, OGG
- **Custom**: Mix of formats with specific rules
- **Upgrade Rules**: Automatically improve quality over time`,
        order: 2,
      },
      {
        id: "lidarr-features",
        title: "UniArr Lidarr Integration Features",
        content: `# UniArr Lidarr Integration Features

## Artist Management

- Browse and search your artist library
- Add new artists for monitoring
- View artist details and discography
- Monitor upcoming album releases
- Track artist information and metadata

## Album and Track Management

- View album details and track listings
- Monitor download progress for albums
- Check missing tracks and albums
- Manual album searches and additions
- Quality upgrade monitoring

## Queue and Download Management

- Real-time download progress tracking
- Queue prioritization and management
- Failed download handling and retries
- Automatic import and organization
- Storage space monitoring

## Calendar Integration

- Upcoming album release tracking
- Artist release schedules
- Music event notifications
- New music discovery
- Release calendar integration with other services

## Search and Discovery

- Powerful search across artists, albums, and tracks
- Advanced filtering by quality, format, and metadata
- Music recommendation features
- Genre-based browsing
- Similar artist discovery`,
        order: 3,
      },
      {
        id: "lidarr-advanced",
        title: "Advanced Lidarr Configuration",
        content: `# Advanced Lidarr Configuration

## Metadata Management

- Automatic metadata tagging
- Custom metadata sources
- Album artwork management
- Lyric integration
- Music library organization

## Integration Settings

- Music library path configuration
- Import quality settings
- File naming conventions
- Folder structure management
- Media player integration

## Notification and Automation

- Download completion alerts
- New album notifications
- Quality upgrade alerts
- Import status updates
- Custom notification rules

## Performance Optimization

- Search interval configuration
- RSS feed management
- Connection limit settings
- Cache management
- Background task scheduling

## Troubleshooting

- Import failure resolution
- Metadata mismatch handling
- Quality profile conflicts
- Storage path issues
- Network connectivity problems`,
        order: 4,
      },
    ],
    relatedResources: [
      "sonarr-setup-guide",
      "radarr-setup-guide",
      "jellyfin-setup-guide",
    ],
    links: [
      {
        title: "Lidarr Official Documentation",
        url: "https://wiki.servarr.com/lidarr",
        type: "external",
        description: "Official Lidarr documentation and guides",
      },
    ],
  },
  {
    id: "jellyfin-setup-guide",
    title: "Jellyfin Media Server Setup",
    description:
      "Complete guide to setting up Jellyfin media server with UniArr integration",
    category: "service-guides",
    type: "guide",
    service: "jellyfin",
    tags: ["jellyfin", "media-server", "streaming", "library"],
    featured: true,
    order: 14,
    lastUpdated: "2024-01-23T15:30:00Z",
    readTime: 25,
    difficulty: "intermediate",
    sections: [
      {
        id: "jellyfin-intro",
        title: "Introduction to Jellyfin",
        content: `# Introduction to Jellyfin

Jellyfin is a free, open-source media server software that allows you to organize, manage, and stream your media collection.

## Key Features

- Media library organization (movies, TV shows, music, photos, books)
- Direct media streaming and transcoding
- Multi-user support with permissions
- Plugin ecosystem for extended functionality
- Live TV and DVR capabilities
- Subtitle management and support
- Mobile apps and web interface
- Metadata management and enrichment

## Use Cases

- Home media server setup
- Media library organization
- Multi-user media access
- Remote streaming capabilities
- Media collection management`,
        order: 1,
      },
      {
        id: "jellyfin-setup",
        title: "Jellyfin Server Setup",
        content: `# Jellyfin Server Setup

## Prerequisites

- Jellyfin server v10.8 or later
- Server hardware meeting minimum requirements
- Media files organized on storage drives
- Network access from mobile devices
- Admin account credentials

## Initial Server Configuration

1. **Install Jellyfin Server**
   - Download appropriate version for your OS
   - Follow installation instructions
   - Start Jellyfin service

2. **Configure Media Libraries**
   - Add media folders (Movies, TV Shows, Music, etc.)
   - Set library types and metadata preferences
   - Configure library scanning schedules
   - Set up parental controls if needed

3. **User Management**
   - Create user accounts
   - Set permissions and access levels
   - Configure parental controls
   - Set up user preferences

## Finding API Key

1. Open Jellyfin web interface
2. Go to Dashboard → API Keys
3. Generate new API key
4. Copy key for UniArr configuration`,
        order: 2,
      },
      {
        id: "jellyfin-uniarr-integration",
        title: "UniArr Integration Features",
        content: `# UniArr Jellyfin Integration Features

## Library Management

- Browse all media libraries (Movies, TV Shows, Music, Photos, Books)
- View detailed media information and metadata
- Search across entire media collection
- Filter by genre, year, rating, and other criteria
- Access recently added and media favorites

## Streaming and Playback

- Direct media streaming within UniArr
- Support for multiple video and audio formats
- Automatic transcoding when needed
- Subtitle selection and management
- Audio track selection
- Resume playback from where you left off

## Download Capabilities

- Download media for offline viewing
- Queue management for downloads
- Progress tracking and notifications
- Storage space management
- Download quality selection

## User and Account Management

- Switch between user profiles
- View user-specific libraries and watchlists
- Manage parental controls
- Access user preferences and settings

## Live TV and DVR

- Live TV channel browsing
- DVR recording management
- TV guide integration
- Scheduled recording management
- Live TV streaming support

## Advanced Features

- Plugin management and configuration
- Metadata editing and management
- Library statistics and reports
- Server health monitoring
- Network diagnostics and troubleshooting`,
        order: 3,
      },
      {
        id: "jellyfin-advanced",
        title: "Advanced Jellyfin Configuration",
        content: `# Advanced Jellyfin Configuration

## Transcoding Settings

- Hardware acceleration (GPU) setup
- Codec configuration and preferences
- Quality and bitrate settings
- Device-specific transcoding profiles
- Network bandwidth optimization

## Network and Security

- SSL/HTTPS configuration
- Remote access setup
- Port forwarding and firewall rules
- VPN integration
- Authentication and security settings

## Plugin Management

- Popular plugins (Subtitles, IMDb, Open Subtitles, etc.)
- Plugin installation and configuration
- Custom plugin development
- Plugin updates and maintenance

## Performance Optimization

- Database optimization
- Cache management
- Hardware resource allocation
- Network optimization
- Storage configuration

## Backup and Maintenance

- Library backup strategies
- Database backup and restore
- System maintenance schedules
- Log management and monitoring
- Update management`,
        order: 4,
      },
    ],
    relatedResources: [
      "sonarr-setup-guide",
      "radarr-setup-guide",
      "lidarr-setup-guide",
    ],
    links: [
      {
        title: "Jellyfin Documentation",
        url: "https://jellyfin.org/docs/",
        type: "external",
        description: "Official Jellyfin documentation",
      },
    ],
  },
  // Download Client Guides
  {
    id: "transmission-setup-guide",
    title: "Transmission Torrent Client Setup",
    description:
      "Complete guide to setting up Transmission with UniArr for torrent management",
    category: "service-guides",
    type: "guide",
    service: "transmission",
    tags: ["transmission", "torrents", "rpc", "download-client"],
    featured: true,
    order: 15,
    lastUpdated: "2024-01-23T16:00:00Z",
    readTime: 18,
    difficulty: "intermediate",
    sections: [
      {
        id: "transmission-intro",
        title: "Introduction to Transmission",
        content: `# Introduction to Transmission

Transmission is a cross-platform BitTorrent client known for its simplicity, reliability, and lightweight design.

## Key Features

- Clean, user-friendly interface
- Native encryption support
- Peer exchange and magnet link support
- Bandwidth scheduling and throttling
- Web remote interface
- Protocol encryption
- DHT, PEX, and magnet links
- Trackers and torrent management

## Use Cases

- General torrent downloading
- Automated torrent management
- Bandwidth-controlled downloading
- Remote torrent management
- Privacy-focused torrenting`,
        order: 1,
      },
      {
        id: "transmission-setup",
        title: "Transmission Setup and Configuration",
        content: `# Transmission Setup and Configuration

## Prerequisites

- Transmission 2.94 or later installed
- RPC interface enabled
- Username and password configured (if using authentication)
- Transmission accessible from mobile device
- Network connectivity verified

## Enabling RPC Interface

1. Open Transmission settings
2. Go to Remote tab or edit settings.json
3. Enable "Allow remote access"
4. Set username and password
5. Configure whitelist (0.0.0.0/0 for all IPs)
6. Set RPC port (default: 9091)
7. Restart Transmission service

## Finding Connection Details

- **URL**: http://192.168.1.100:9091 (replace with your server IP)
- **Username**: Set in Transmission settings
- **Password**: Set in Transmission settings
- **RPC Path**: /transmission/rpc (automatically handled by UniArr)

## Connecting to UniArr

1. In UniArr, go to Services → Add Service
2. Select "Transmission" from the list
3. Enter your Transmission URL
4. Input username and password (if configured)
5. Test connection
6. Save configuration

## Common Connection Issues

- Firewall blocking RPC port
- Incorrect IP address or port
- Authentication credentials wrong
- RPC not enabled in Transmission settings
- Network connectivity problems`,
        order: 2,
      },
      {
        id: "transmission-features",
        title: "UniArr Transmission Features",
        content: `# UniArr Transmission Integration Features

## Torrent Management

- View all torrents with detailed information
- Start, pause, and stop torrents
- Remove torrents (with or without deleting files)
- Verify torrent data integrity
- Force recheck and announce
- Queue management and prioritization

## Transfer Statistics

- Real-time download and upload speeds
- Peer and seed information
- Tracker status and statistics
- Progress indicators and ETA
- Ratio and availability information
- Bandwidth usage monitoring

## Advanced Controls

- Bandwidth limits and throttling
- Alternative speed limits
- Queue position management
- Sequential downloading
- Peer connection limits
- Port configuration

## Torrent Details

- File list within torrents
- Trackers and peer information
- Torrent health and availability
- Creation date and added time
- Torrent size and completion status

## Search and Filtering

- Filter torrents by status (downloading, seeding, paused)
- Search torrent names and files
- Sort by various criteria
- Active torrents only view
- Filter by labels or tags (if supported)

## Automation Features

- Automatic torrent management
- Seed ratio limits
- Idle seeding limits
- Download scheduling
- Automatic stop conditions`,
        order: 3,
      },
    ],
    relatedResources: [
      "qbittorrent-setup-guide",
      "deluge-setup-guide",
      "download-problems",
    ],
    links: [
      {
        title: "Transmission Documentation",
        url: "https://transmissionbt.com/documentation/",
        type: "external",
        description: "Official Transmission documentation",
      },
    ],
  },
  {
    id: "sabnzbd-setup-guide",
    title: "SABnzbd Usenet Client Setup",
    description:
      "Complete guide to setting up SABnzbd with UniArr for Usenet downloading",
    category: "service-guides",
    type: "guide",
    service: "sabnzbd",
    tags: ["sabnzbd", "usenet", "nzb", "download-client"],
    featured: true,
    order: 16,
    lastUpdated: "2024-01-23T16:30:00Z",
    readTime: 20,
    difficulty: "intermediate",
    sections: [
      {
        id: "sabnzbd-intro",
        title: "Introduction to SABnzbd",
        content: `# Introduction to SABnzbd

SABnzbd is a cross-platform binary newsreader designed for downloading from Usenet servers with a focus on automation and ease of use.

## Key Features

- Web-based interface for easy access
- Automatic repair and unpack of downloads
- NZB file processing and queuing
- SSL/TLS encryption support
- Multiple server support
- Email notifications
- Mobile-optimized interface
- API for third-party integration

## Use Cases

- Automated media downloading from Usenet
- NZB file management and processing
- High-speed downloading with reliability
- Automatic post-processing
- Remote download management`,
        order: 1,
      },
      {
        id: "sabnzbd-setup",
        title: "SABnzbd Setup and Configuration",
        content: `# SABnzbd Setup and Configuration

## Prerequisites

- SABnzbd 3.0 or later installed
- Usenet server access (provider)
- API key configured in SABnzbd
- SABnzbd accessible from mobile device
- Network connectivity verified

## Initial Configuration

1. **Install and Start SABnzbd**
   - Download and install SABnzbd
   - Launch the application
   - Complete initial setup wizard

2. **Configure Usenet Servers**
   - Add primary Usenet server details
   - Configure SSL/TLS settings
   - Set connection limits
   - Test server connectivity

3. **Configure Categories and Folders**
   - Set download categories
   - Configure download paths
   - Set up post-processing folders
   - Configure naming schemes

## Finding API Key

1. Open SABnzbd web interface
2. Go to Config → General
3. Look for "API Key" section
4. Generate or copy existing API key
5. Note your SABnzbd URL and port

## Connecting to UniArr

1. In UniArr, go to Services → Add Service
2. Select "SABnzbd" from the service list
3. Enter your SABnzbd URL (e.g., http://192.168.1.100:8080)
4. Paste your API key
5. Test connection
6. Save configuration`,
        order: 2,
      },
      {
        id: "sabnzbd-features",
        title: "UniArr SABnzbd Integration Features",
        content: `# UniArr SABnzbd Integration Features

## Queue Management

- View current download queue with progress
- Pause, resume, and remove downloads
- Change download priority
- View download speed and ETA
- Monitor download completion status
- Queue history and statistics

## Download Monitoring

- Real-time download progress tracking
- Speed and bandwidth monitoring
- Remaining time estimates
- Download health indicators
- Server connection status
- SSL/TLS connection verification

## History and Completed Downloads

- View completed downloads history
- Check download success/failure status
- Monitor repair and unpack operations
- View download statistics and reports
- Clean up completed downloads
- Download retry options

## Post-Processing Features

- Automatic repair verification
- Unpack monitoring and status
- Script execution status
- Download validation results
- Error handling and reporting

## Advanced Controls

- Server configuration management
- Connection limit adjustments
- Bandwidth throttling settings
- Category-based organization
- Download scheduling options

## Notifications and Alerts

- Download completion notifications
- Failure alerts and error reports
- Queue status changes
- Storage space warnings
- Server connectivity issues`,
        order: 3,
      },
    ],
    relatedResources: [
      "qbittorrent-setup-guide",
      "nzbhydra-setup-guide",
      "download-problems",
    ],
    links: [
      {
        title: "SABnzbd Documentation",
        url: "https://sabnzbd.org/wiki/",
        type: "external",
        description: "Official SABnzbd documentation",
      },
    ],
  },
  {
    id: "deluge-setup-guide",
    title: "Deluge Torrent Client Setup",
    description:
      "Complete guide to setting up Deluge with UniArr for torrent management via JSON-RPC",
    category: "service-guides",
    type: "guide",
    service: "deluge",
    tags: ["deluge", "torrents", "json-rpc", "download-client"],
    featured: false,
    order: 17,
    lastUpdated: "2024-01-23T17:00:00Z",
    readTime: 18,
    difficulty: "advanced",
    sections: [
      {
        id: "deluge-intro",
        title: "Introduction to Deluge",
        content: `# Introduction to Deluge

Deluge is a lightweight, full-featured BitTorrent client that features a plugin ecosystem and multiple user interfaces.

## Key Features

- Modular design with plugin support
- Multiple user interfaces (GTK, Web, Console)
- BitTorrent Protocol Encryption
- UPnP and NAT-PMP port forwarding
- Local Peer Discovery
- Proxy support
- Bandwidth scheduling
- Web UI for remote management

## Use Cases

- Advanced torrent management
- Custom plugin functionality
- Remote torrent management
- Bandwidth-controlled downloading
- Multi-user torrent access`,
        order: 1,
      },
      {
        id: "deluge-setup",
        title: "Deluge Setup and Configuration",
        content: `# Deluge Setup and Configuration

## Prerequisites

- Deluge 2.0 or later installed
- Deluge Web UI or Deluge Daemon running
- JSON-RPC interface enabled
- Authentication configured
- Deluge accessible from mobile device

## Enabling JSON-RPC Interface

1. Install Deluge Web UI plugin if not already installed
2. Start Deluge daemon: \`deluged\`
3. Start Deluge Web UI: \`deluge-web\`
4. Configure authentication in Web UI preferences
5. Set connection password for remote access

## Connection Details

- **URL**: http://192.168.1.100:8112 (default Web UI port)
- **Username**: Your Deluge Web UI username
- **Password**: Your Deluge Web UI password
- **JSON-RPC**: Automatically handled by UniArr

## Connecting to UniArr

1. In UniArr, go to Services → Add Service
2. Select "Deluge" from the service list
3. Enter your Deluge Web UI URL
4. Input authentication credentials
5. Test JSON-RPC connection
6. Save configuration

## Common Issues

- Deluge daemon not running
- Web UI not enabled
- Authentication problems
- Firewall blocking port 8112
- Plugin configuration errors`,
        order: 2,
      },
      {
        id: "deluge-features",
        title: "UniArr Deluge Features",
        content: `# UniArr Deluge Integration Features

## Torrent Management

- Complete torrent list with status information
- Start, pause, stop, and remove torrents
- Force reannounce and recheck operations
- Queue management and prioritization
- Torrent details and file information

## Transfer Statistics

- Download and upload speed monitoring
- Peer and seed counts
- Progress percentages and ETA
- Share ratios and availability
- Bandwidth usage tracking

## Advanced Controls

- Bandwidth limits per torrent
- Global upload/download speed limits
- Sequential downloading options
- Peer connection management
- Tracker management and editing

## Plugin Integration

- Monitor plugin status and functionality
- Plugin configuration through UniArr interface
- Enhanced features through plugins
- Plugin updates and management

## Search and Filtering

- Filter torrents by status (Active, Downloading, Seeding, etc.)
- Search torrent names and files
- Sort by size, progress, ratio, and more
- Label and category support

## Queue and Priority

- Queue position management
- Download priority adjustments
- Seed time and ratio limits
- Automatic queue management
- Priority-based bandwidth allocation`,
        order: 3,
      },
    ],
    relatedResources: ["transmission-setup-guide", "qbittorrent-setup-guide"],
    links: [
      {
        title: "Deluge Documentation",
        url: "https://dev.deluge-torrent.org/wiki/",
        type: "external",
        description: "Official Deluge documentation",
      },
    ],
  },
  // Media Enhancement Services
  {
    id: "bazarr-setup-guide",
    title: "Bazarr Subtitle Management Setup",
    description:
      "Complete guide to setting up Bazarr for automatic subtitle downloads and management",
    category: "service-guides",
    type: "guide",
    service: "bazarr",
    tags: ["bazarr", "subtitles", "automation", "media-enhancement"],
    featured: true,
    order: 18,
    lastUpdated: "2024-01-23T17:30:00Z",
    readTime: 20,
    difficulty: "intermediate",
    sections: [
      {
        id: "bazarr-intro",
        title: "Introduction to Bazarr",
        content: `# Introduction to Bazarr

Bazarr is a companion application to Sonarr and Radarr that manages and downloads subtitles for your media files.

## Key Features

- Automatic subtitle downloads for movies and TV episodes
- Integration with Sonarr and Radarr
- Multiple subtitle providers and languages
- Custom subtitle scoring and quality thresholds
- Subtitle history and management
- Webhook notifications for subtitle events
- Subtitle preview and selection
- Custom download rules and filters

## Use Cases

- Automated subtitle management for media libraries
- Multi-language subtitle collections
- Subtitle quality control and customization
- Integration with existing media management workflows
- Accessibility enhancement for media content`,
        order: 1,
      },
      {
        id: "bazarr-setup",
        title: "Bazarr Setup and Configuration",
        content: `# Bazarr Setup and Configuration

## Prerequisites

- Bazarr v1.0 or later installed and running
- Sonarr and/or Radarr instances set up
- API keys from Sonarr/Radarr
- Bazarr accessible from mobile device
- Subtitle provider accounts (optional)

## Initial Configuration

1. **Install and Start Bazarr**
   - Download and install Bazarr
   - Launch the application
   - Complete initial setup wizard

2. **Configure Sonarr/Radarr Integration**
   - Add Sonarr instances with API keys
   - Add Radarr instances with API keys
   - Test connections to media managers
   - Import existing media libraries

3. **Set Up Subtitle Providers**
   - Configure OpenSubtitles account (recommended)
   - Add other providers as needed
   - Set provider priorities
   - Configure API keys and credentials

## Finding API Key

1. Open Bazarr web interface (usually http://localhost:6767)
2. Go to Settings → General
3. Look for API key in the Security section
4. Copy the API key for UniArr configuration

## Connecting to UniArr

1. In UniArr, go to Services → Add Service
2. Select "Bazarr" from the service list
3. Enter your Bazarr URL (e.g., http://192.168.1.100:6767)
4. Paste your API key
5. Test connection
6. Save configuration`,
        order: 2,
      },
      {
        id: "bazarr-features",
        title: "UniArr Bazarr Integration Features",
        content: `# UniArr Bazarr Integration Features

## Subtitle Management

- View subtitle status for movies and episodes
- Monitor automatic subtitle downloads
- Manual subtitle search and downloads
- Subtitle history and tracking
- Missing subtitle identification
- Subtitle quality and scoring

## Language Management

- Configure multiple language preferences
- Monitor subtitle downloads per language
- Language-specific search and filtering
- Custom language codes and naming
- Regional subtitle variations

## Provider Integration

- Monitor provider status and availability
- View provider-specific download statistics
- Manage provider API keys and limits
- Provider performance monitoring
- Automatic provider failover

## Series and Movie Management

- Browse media libraries with subtitle status
- View subtitle availability for specific titles
- Episode-specific subtitle management
- Movie subtitle collection overview
- Missing subtitle notifications

## Search and Discovery

- Advanced subtitle search capabilities
- Filter by language, quality, and provider
- Search for specific subtitle releases
- Preview subtitle information before download
- Search result customization

## Automation and Rules

- Custom subtitle download rules
- Quality thresholds and scoring
- Automatic subtitle upgrades
- Scheduled subtitle searches
- Notification preferences`,
        order: 3,
      },
    ],
    relatedResources: [
      "sonarr-setup-guide",
      "radarr-setup-guide",
      "jellyfin-setup-guide",
    ],
    links: [
      {
        title: "Bazarr Documentation",
        url: "https://wiki.bazarr.media/",
        type: "external",
        description: "Official Bazarr documentation",
      },
    ],
  },
  {
    id: "prowlarr-setup-guide",
    title: "Prowlarr Indexer Management Setup",
    description:
      "Complete guide to setting up Prowlarr for centralized indexer management",
    category: "service-guides",
    type: "guide",
    service: "prowlarr",
    tags: ["prowlarr", "indexers", "torrent-sites", "automation"],
    featured: true,
    order: 19,
    lastUpdated: "2024-01-23T18:00:00Z",
    readTime: 22,
    difficulty: "advanced",
    sections: [
      {
        id: "prowlarr-intro",
        title: "Introduction to Prowlarr",
        content: `# Introduction to Prowlarr

Prowlarr is a indexer manager/proxy that integrates with various torrent trackers and Usenet indexers, providing a unified interface for Sonarr, Radarr, Lidarr, and Readarr.

## Key Features

- Centralized indexer management
- Support for 1000+ torrent trackers and Usenet indexers
- Automatic indexer testing and validation
- Proxy functionality for media managers
- Custom app profiles for different media managers
- Indexer statistics and health monitoring
- RSS feed generation and management
- Advanced filtering and tagging

## Use Cases

- Managing multiple indexers from one interface
- Improving search success rates across media managers
- Centralizing indexer authentication and configuration
- Monitoring indexer health and performance
- Automating indexer setup for new services`,
        order: 1,
      },
      {
        id: "prowlarr-setup",
        title: "Prowlarr Setup and Configuration",
        content: `# Prowlarr Setup and Configuration

## Prerequisites

- Prowlarr v1.0 or later installed and running
- Administrator access to Prowlarr interface
- Accounts with various torrent trackers/Usenet providers
- Sonarr/Radarr/Lidarr instances to connect
- Prowlarr accessible from mobile device

## Initial Configuration

1. **Install and Start Prowlarr**
   - Download and install Prowlarr
   - Launch the application
   - Complete initial setup wizard

2. **Configure Indexers**
   - Add torrent tracker accounts
   - Configure Usenet indexer credentials
   - Test indexer connections
   - Set indexer priorities and tags

3. **Set Up Applications**
   - Add Sonarr/Radarr/Lidarr instances
   - Generate API keys for each application
   - Configure application-specific settings
   - Test application connections

## Finding API Key

1. Open Prowlarr web interface (usually http://localhost:9696)
2. Go to Settings → General
3. Look for "API Key" in the Security section
4. Copy the API key for UniArr configuration

## Connecting to UniArr

1. In UniArr, go to Services → Add Service
2. Select "Prowlarr" from the service list
3. Enter your Prowlarr URL (e.g., http://192.168.1.100:9696)
4. Paste your API key
5. Test connection
6. Save configuration`,
        order: 2,
      },
      {
        id: "prowlarr-features",
        title: "UniArr Prowlarr Integration Features",
        content: `# UniArr Prowlarr Integration Features

## Indexer Management

- View all configured indexers and their status
- Monitor indexer health and availability
- Test indexer connections and responsiveness
- View indexer statistics and success rates
- Manage indexer tags and categories
- Configure indexer-specific settings

## Application Integration

- Monitor connected applications (Sonarr, Radarr, etc.)
- View application-specific indexer usage
- Manage application API keys and permissions
- Configure application profiles and settings
- Monitor application health and connectivity

## Search and Discovery

- Unified search across all configured indexers
- Advanced filtering by indexer type, category, and tags
- Search result aggregation and ranking
- Custom search queries and filters
- Historical search data and statistics

## Statistics and Monitoring

- Indexer performance metrics
- Search success rates and statistics
- Bandwidth usage tracking
- API request monitoring
- Error tracking and diagnostics

## RSS Feed Management

- RSS feed configuration and monitoring
- Custom feed creation and management
- Feed health and update status
- Automated feed testing
- Feed-based automation rules

## Advanced Configuration

- Custom indexer profiles and templates
- Proxy settings and routing
- Rate limiting and throttling
- Backup and restore indexer configurations
- Bulk indexer management operations`,
        order: 3,
      },
    ],
    relatedResources: [
      "sonarr-setup-guide",
      "radarr-setup-guide",
      "lidarr-setup-guide",
    ],
    links: [
      {
        title: "Prowlarr Documentation",
        url: "https://wiki.servarr.com/prowlarr",
        type: "external",
        description: "Official Prowlarr documentation",
      },
    ],
  },
  // Network and Security Services
  {
    id: "adguard-setup-guide",
    title: "AdGuard Home DNS Filtering Setup",
    description:
      "Complete guide to setting up AdGuard Home for network-level ad blocking and DNS filtering",
    category: "service-guides",
    type: "guide",
    service: "adguard",
    tags: ["adguard", "dns", "network-security", "ad-blocking"],
    featured: true,
    order: 20,
    lastUpdated: "2024-01-23T18:30:00Z",
    readTime: 18,
    difficulty: "advanced",
    sections: [
      {
        id: "adguard-intro",
        title: "Introduction to AdGuard Home",
        content: `# Introduction to AdGuard Home

AdGuard Home is a network-wide software for blocking ads and tracking on all devices in your home network without any client-side software.

## Key Features

- Network-wide ad blocking
- DNS filtering and customization
- Encrypted DNS support (DoH, DoT)
- Custom blocklists and allowlists
- Query logging and statistics
- Parental controls and safe browsing
- DHCP server functionality
- Network device management

## Use Cases

- Network-level ad blocking
- Enhanced privacy and security
- Parental controls and content filtering
- DNS-based malware protection
- Improved network performance
- Custom DNS resolution rules`,
        order: 1,
      },
      {
        id: "adguard-setup",
        title: "AdGuard Home Setup and Configuration",
        content: `# AdGuard Home Setup and Configuration

## Prerequisites

- AdGuard Home v0.107 or later installed
- Network administrator access
- Static IP address for AdGuard Home server
- Router access for DNS configuration
- AdGuard Home accessible from mobile device

## Initial Configuration

1. **Install AdGuard Home**
   - Download appropriate version for your platform
   - Run installation script
   - Complete initial setup wizard
   - Set admin credentials

2. **Configure Network Settings**
   - Set up static IP or reserved DHCP
   - Configure DNS settings
   - Set up encryption (HTTPS)
   - Configure firewall rules

3. **Configure DNS Filtering**
   - Set upstream DNS servers
   - Add blocklists and filters
   - Configure custom rules
   - Set up parental controls

## Finding Connection Details

- **URL**: http://192.168.1.100:3000 (default port)
- **Username**: Your AdGuard Home admin username
- **Password**: Your AdGuard Home admin password

## Connecting to UniArr

1. In UniArr, go to Services → Add Service
2. Select "AdGuard Home" from the service list
3. Enter your AdGuard Home URL
4. Input admin credentials
5. Test connection
6. Save configuration`,
        order: 2,
      },
      {
        id: "adguard-features",
        title: "UniArr AdGuard Home Features",
        content: `# UniArr AdGuard Home Integration Features

## Protection Management

- Enable/disable DNS protection
- Toggle ad blocking on/off
- Manage safe browsing and parental controls
- Configure protection schedules
- View real-time protection status

## Query Monitoring and Statistics

- View DNS query logs and history
- Monitor blocked queries statistics
- Analyze top blocked domains
- Track query volume and trends
- Device-specific query breakdown
- Time-based query analysis

## Filter Management

- Add and remove custom blocklists
- Update and refresh filters
- Configure custom filtering rules
- Manage allowlists and exceptions
- Schedule automatic filter updates

## Network and Device Management

- View connected devices on network
- Monitor device-specific statistics
- Configure device-specific rules
- DHCP lease management
- Network topology overview

## Security and Privacy Features

- Monitor DNS encryption status
- View blocked threats and malware
- Track phishing protection statistics
- Safe browsing enforcement
- Custom DNS rules configuration

## Advanced Configuration

- Configure upstream DNS servers
- Set up conditional forwarding
- Manage DNS cache settings
- Configure encryption protocols
- Backup and restore configuration`,
        order: 3,
      },
    ],
    relatedResources: ["network-diagnostics", "security-best-practices"],
    links: [
      {
        title: "AdGuard Home Documentation",
        url: "https://github.com/AdguardTeam/AdGuardHome/wiki",
        type: "external",
        description: "Official AdGuard Home documentation",
      },
    ],
  },
  // External API Services
  {
    id: "tmdb-api-guide",
    title: "TMDB API Integration Guide",
    description:
      "Complete guide to integrating The Movie Database (TMDB) API with UniArr",
    category: "service-guides",
    type: "guide",
    service: "tmdb",
    tags: ["tmdb", "api", "metadata", "media-database"],
    featured: true,
    order: 21,
    lastUpdated: "2024-01-23T19:00:00Z",
    readTime: 15,
    difficulty: "intermediate",
    sections: [
      {
        id: "tmdb-intro",
        title: "Introduction to TMDB API",
        content: `# Introduction to TMDB API

The Movie Database (TMDB) is a popular, user-editable database for movies and TV shows with a comprehensive API for accessing media metadata.

## Key Features

- Extensive movie and TV show database
- Rich metadata including cast, crew, and images
- Multiple language support
- Search functionality across all content
- Watch provider integration
- User ratings and reviews
- Collection and franchise information
- API v3 and v4 support

## Use Cases

- Enriching media metadata in UniArr
- Powering search and discovery features
- Providing detailed media information
- Supporting watch provider integration
- Enhancing user experience with rich content`,
        order: 1,
      },
      {
        id: "tmdb-setup",
        title: "TMDB API Setup and Configuration",
        content: `# TMDB API Setup and Configuration

## Prerequisites

- TMDB account (free registration)
- API v3 key from TMDB
- (Optional) API v4 read access token
- Understanding of API rate limits
- UniArr with network access to TMDB

## Getting API Credentials

1. **Register TMDB Account**
   - Go to https://www.themoviedb.org/
   - Create a free account
   - Verify email address

2. **Request API Key**
   - Go to Settings → API in TMDB
   - Fill out developer application form
   - Describe your UniArr application
   - Wait for approval (usually immediate)

3. **Get API Details**
   - Copy API v3 key
   - (Optional) Generate v4 read access token
   - Note your API key for UniArr configuration

## API Usage Guidelines

- **Rate Limits**: 40 requests per 10 seconds (v3 API)
- **Attribution**: Must credit TMDB for data usage
- **Commercial Use**: Requires approval for commercial applications
- **Data Usage**: Follow TMDB terms of service

## Connecting to UniArr

1. In UniArr, go to Services → Add Service
2. Select "TMDB" from the service list
3. Enter your API v3 key (required)
4. (Optional) Enter API v4 token for advanced features
5. Test connection
6. Save configuration`,
        order: 2,
      },
      {
        id: "tmdb-features",
        title: "UniArr TMDB Integration Features",
        content: `# UniArr TMDB Integration Features

## Movie Information

- Detailed movie metadata (overview, genres, runtime)
- Cast and crew information with profiles
- Production details and companies
- Release dates and countries
- Budget and revenue information
- Movie ratings and reviews
- Poster and backdrop images

## TV Show Information

- Series overview and details
- Season and episode information
- Cast and crew across seasons
- Network and streaming information
- Show ratings and popularity
- Episode air dates and summaries
- TV show images and posters

## Search and Discovery

- Multi-type search (movies, TV shows, people)
- Advanced filtering options
- Genre-based browsing
- Year and rating filters
- Multi-language search support
- Search result ranking and relevance

## Enhanced Features

- Watch provider integration
- Collection and franchise information
- Similar movies and TV recommendations
- Person filmography and biographies
- Trending content discovery
- Popular and top-rated content

## Image and Media Support

- High-resolution poster images
- Backdrop and still images
- Profile images for cast/crew
- Logo and clear art images
- Image caching and optimization
- Multi-language poster support

## Advanced API Features

- Append-to-response for multiple data types
- Authentication for personalized features
- Watchlist and favorites integration
- Account-specific recommendations
- Custom list management`,
        order: 3,
      },
    ],
    relatedResources: [
      "sonarr-setup-guide",
      "radarr-setup-guide",
      "jellyfin-setup-guide",
    ],
    links: [
      {
        title: "TMDB API Documentation",
        url: "https://developers.themoviedb.org/3",
        type: "external",
        description: "Official TMDB API documentation",
      },
      {
        title: "TMDB API Key Request",
        url: "https://www.themoviedb.org/settings/api",
        type: "external",
        description: "Request TMDB API access",
      },
    ],
  },
  // Existing service guides continue below
  {
    id: "sonarr-setup-guide",
    title: "Sonarr Setup and Configuration",
    description:
      "Complete guide to setting up Sonarr with UniArr for TV show management",
    category: "service-guides",
    type: "guide",
    service: "sonarr",
    tags: ["sonarr", "tv-shows", "setup", "configuration"],
    featured: true,
    order: 10,
    lastUpdated: "2024-01-18T16:00:00Z",
    readTime: 20,
    difficulty: "intermediate",
    sections: [
      {
        id: "prerequisites",
        title: "Prerequisites",
        content: `# Prerequisites

Before connecting Sonarr to UniArr, ensure:

- Sonarr v3 or v4 is installed and running
- You have administrator access to Sonarr
- Your Sonarr instance is accessible from your mobile device
- You know your Sonarr URL and API key

## Finding Your API Key

1. Open Sonarr web interface
2. Go to Settings → General
3. Look for "API Key" in the Security section
4. Copy the key for use in UniArr`,
        order: 1,
      },
      {
        id: "connecting-uniarr",
        title: "Connecting to UniArr",
        content: `# Connecting to UniArr

Steps to connect Sonarr to UniArr:

1. Open UniArr and go to Services tab
2. Tap "Add Service"
3. Select "Sonarr" from the list
4. Enter your Sonarr URL (e.g., http://192.168.1.100:8989)
5. Paste your API key
6. Configure optional settings:
   - Custom name for the service
   - Enable notifications
   - Set refresh intervals
7. Test the connection
8. Save the configuration

## Troubleshooting Tips

- Ensure the URL includes the protocol (http/https)
- Check firewall settings if connection fails
- Verify the API key has necessary permissions`,
        order: 2,
      },
      {
        id: "features-overview",
        title: "UniArr Sonarr Features",
        content: `# UniArr Sonarr Features

Once connected, UniArr provides:

## Dashboard Integration

- Service status and health monitoring
- Queue overview with progress indicators
- Recent downloads and activity
- Disk space usage

## Show Management

- Browse and search your TV library
- Add new series to monitoring
- View episode details and status
- Manual episode searches

## Queue Management

- Monitor download progress
- Pause/resume/remove downloads
- Priority adjustments
- Bulk operations

## Calendar Integration

- View upcoming episode releases
- Season premiere tracking
- Missing episode identification`,
        order: 3,
      },
      {
        id: "advanced-settings",
        title: "Advanced Configuration",
        content: `# Advanced Configuration

For power users, UniArr offers advanced Sonarr settings:

## Custom Notifications

- Download completion alerts
- Failed download notifications
- Season premiere reminders

## Integration Settings

- Custom refresh intervals
- Cache management
- Offline mode support

## Quality Profiles

- View and manage quality profiles
- Upgrade rule monitoring
- Custom format support

## Automation

- Automatic library refreshes
- Smart series recommendations
- Backup and restore settings`,
        order: 4,
      },
    ],
    relatedResources: [
      "radarr-setup-guide",
      "jellyseerr-setup-guide",
      "troubleshooting-connections",
    ],
    links: [
      {
        title: "Sonarr Official Documentation",
        url: "https://wiki.servarr.com/sonarr",
        type: "external",
        description: "Official Sonarr documentation and guides",
      },
    ],
  },
  {
    id: "radarr-setup-guide",
    title: "Radarr Setup and Configuration",
    description:
      "Complete guide to setting up Radarr with UniArr for movie management",
    category: "service-guides",
    type: "guide",
    service: "radarr",
    tags: ["radarr", "movies", "setup", "configuration"],
    featured: true,
    order: 11,
    lastUpdated: "2024-01-18T16:15:00Z",
    readTime: 20,
    difficulty: "intermediate",
    sections: [
      {
        id: "radarr-prerequisites",
        title: "Prerequisites",
        content: `# Prerequisites

Before connecting Radarr to UniArr:

- Radarr v4 or later is installed and running
- Administrator access to Radarr
- Radarr accessible from mobile device
- Radarr URL and API key available

## Finding Your API Key

1. Open Radarr web interface
2. Navigate to Settings → General
3. Locate "API Key" in Security section
4. Copy the key for UniArr configuration`,
        order: 1,
      },
      {
        id: "radarr-connection",
        title: "Connecting Radarr to UniArr",
        content: `# Connecting Radarr to UniArr

Connection process:

1. In UniArr, go to Services → Add Service
2. Choose "Radarr" from service list
3. Enter Radarr URL (e.g., http://192.168.1.100:7878)
4. Input your API key
5. Configure service settings:
   - Service display name
   - Notification preferences
   - Refresh frequency
6. Test connection
7. Save configuration

## Common Issues

- URL format errors (include http/https)
- Network connectivity problems
- API key permission issues
- Firewall blocking access`,
        order: 2,
      },
      {
        id: "radarr-features",
        title: "UniArr Radarr Features",
        content: `# UniArr Radarr Features

Radarr integration provides:

## Movie Library Management

- Browse and search movie collection
- Add new movies for monitoring
- View movie details and metadata
- Import existing movie files

## Download Queue

- Real-time download progress
- Queue prioritization
- Failed download handling
- Automatic retry management

## Quality Management

- Quality profile configuration
- Upgrade rule monitoring
- Custom format support
- Release profile management

## Calendar and Releases

- Upcoming movie releases
- Theater release tracking
- Digital release dates
- Physical media release tracking`,
        order: 3,
      },
    ],
    relatedResources: ["sonarr-setup-guide", "jellyseerr-setup-guide"],
  },
  {
    id: "jellyseerr-setup-guide",
    title: "Jellyseerr Request System",
    description: "Setting up Jellyseerr for media requests and user management",
    category: "service-guides",
    type: "guide",
    service: "jellyseerr",
    tags: ["jellyseerr", "requests", "user-management", "approval"],
    featured: true,
    order: 12,
    lastUpdated: "2024-01-19T11:00:00Z",
    readTime: 18,
    difficulty: "intermediate",
    sections: [
      {
        id: "jellyseerr-intro",
        title: "Introduction to Jellyseerr",
        content: `# Introduction to Jellyseerr

Jellyseerr is a request management system for media:

## Key Features

- User-friendly request interface
- Approval workflows
- Notification system
- Integration with Sonarr/Radarr
- User management and permissions

## Use Cases

- Family media sharing
- Roommate/tenant media requests
- Community media management
- Automated request processing`,
        order: 1,
      },
      {
        id: "jellyseerr-setup",
        title: "Initial Setup",
        content: `# Initial Setup

Setting up Jellyseerr:

## 1. Install Jellyseerr

- Docker or native installation
- Configure environment variables
- Set up initial admin account

## 2. Connect Services

- Link Sonarr instance
- Link Radarr instance
- Configure Jellyfin/Plex integration

## 3. Configure UniArr

- Add Jellyseerr service
- Enter API credentials
- Test connection

## 4. User Setup

- Create user accounts
- Set permissions
- Configure notification preferences`,
        order: 2,
      },
      {
        id: "jellyseerr-workflows",
        title: "Request Workflows",
        content: `# Request Workflows

Request management in UniArr:

## Submitting Requests

- Search for movies/TV shows
- Select quality preferences
- Add request details
- Submit for approval

## Approval Process

- Review pending requests
- Check availability
- Approve or deny requests
- Add notes/conditions

## Notification System

- Request status updates
- Approval notifications
- Download completion alerts
- Available notifications`,
        order: 3,
      },
    ],
    relatedResources: ["sonarr-setup-guide", "radarr-setup-guide"],
  },
  // Troubleshooting
  {
    id: "connection-issues",
    title: "Troubleshooting Service Connections",
    description:
      "Common connection issues and solutions for all UniArr services",
    category: "troubleshooting",
    type: "troubleshooting",
    service: "general",
    tags: ["troubleshooting", "connections", "network", "api"],
    featured: true,
    order: 30,
    lastUpdated: "2024-01-22T09:30:00Z",
    readTime: 12,
    difficulty: "intermediate",
    sections: [
      {
        id: "common-issues",
        title: "Common Connection Problems",
        content: `# Common Connection Problems

Frequently encountered connection issues:

## Network Connectivity

- Service not accessible from mobile device
- Firewall blocking connections
- Incorrect IP addresses or ports
- DNS resolution problems

## API Key Issues

- Invalid or expired API keys
- Insufficient permissions
- API disabled in service settings
- Key format errors

## URL Configuration

- Missing protocol (http/https)
- Incorrect port numbers
- Reverse proxy configurations
- SSL/TLS certificate issues`,
        order: 1,
      },
      {
        id: "diagnostic-steps",
        title: "Diagnostic Steps",
        content: `# Diagnostic Steps

Systematic troubleshooting approach:

## 1. Verify Service Accessibility

- Try accessing service URL in mobile browser
- Check from the same network as UniArr
- Test with different devices

## 2. Validate API Key

- Regenerate API key in service settings
- Test API endpoint with curl or Postman
- Check API key permissions

## 3. Network Configuration

- Disable VPN temporarily
- Check router firewall settings
- Verify port forwarding
- Test with mobile data vs WiFi

## 4. UniArr Configuration

- Double-check URL format
- Ensure no trailing slashes
- Verify API key is copied correctly
- Test connection in UniArr`,
        order: 2,
      },
      {
        id: "service-specific",
        title: "Service-Specific Solutions",
        content: `# Service-Specific Solutions

Solutions for specific services:

## Sonarr/Radarr

- Check if API is enabled in Settings → General
- Verify API key has correct permissions
- Ensure service version compatibility

## qBittorrent

- Enable Web UI in qBittorrent settings
- Check if alternative Web UI is enabled
- Verify authentication method

## Jellyseerr

- Confirm Jellyseerr is running and accessible
- Check API rate limits
- Verify user permissions

## Prowlarr

- Ensure API key is valid
- Check indexer configurations
- Verify service authentication`,
        order: 3,
      },
      {
        id: "advanced-troubleshooting",
        title: "Advanced Troubleshooting",
        content: `# Advanced Troubleshooting

For complex connection issues:

## Network Analysis

- Use network scanning tools
- Check router logs
- Monitor network traffic
- Test with different network segments

## Service Logs

- Check service error logs
- Monitor API request logs
- Look for rate limiting messages
- Review authentication failures

## UniArr Debug Mode

- Enable debug logging in UniArr
- Check connection attempt logs
- Review API response codes
- Monitor network request timing

## External Tools

- Use Postman for API testing
- Monitor with Wireshark
- Test with curl commands
- Check SSL certificates`,
        order: 4,
      },
    ],
    relatedResources: ["getting-started-uniarr", "network-diagnostics"],
  },
  {
    id: "download-problems",
    title: "Download Issues and Solutions",
    description:
      "Comprehensive troubleshooting guide for download-related problems",
    category: "troubleshooting",
    type: "troubleshooting",
    service: "qbittorrent",
    tags: ["downloads", "qbittorrent", "torrents", "issues"],
    featured: false,
    order: 31,
    lastUpdated: "2024-01-21T13:45:00Z",
    readTime: 15,
    difficulty: "advanced",
    sections: [
      {
        id: "download-failures",
        title: "Download Failures",
        content: `# Download Failures

Common download failure scenarios:

## Connection Issues

- Tracker not responding
- Peer connection problems
- Network connectivity issues
- ISP blocking/throttling

## Storage Problems

- Insufficient disk space
- Permission errors
- Drive not mounted
- Corrupted file system

## Configuration Errors

- Incorrect save paths
- Missing categories
- Network interface selection
- Bandwidth limit settings`,
        order: 1,
      },
      {
        id: "slow-downloads",
        title: "Slow Download Speeds",
        content: `# Slow Download Speeds

Optimizing download speeds:

## Network Optimization

- Check internet connection speed
- Configure port forwarding
- Use wired connections
- Optimize router settings

## qBittorrent Settings

- Adjust global rate limits
- Configure per-torrent limits
- Enable sequential downloading
- Optimize connection settings

## Tracker Management

- Add multiple trackers
- Update tracker lists regularly
- Use private trackers when available
- Monitor tracker health`,
        order: 2,
      },
      {
        id: "queue-management",
        title: "Queue Management Issues",
        content: `# Queue Management Issues

Resolving queue problems:

## Queue Stuck

- Restart qBittorrent service
- Clear stalled downloads
- Check for file locking
- Verify disk space

## Priority Issues

- Adjust torrent priorities
- Configure sequential downloading
- Manage active download limits
- Balance upload/download ratios`,
        order: 3,
      },
    ],
  },
  // Configuration
  {
    id: "notification-setup",
    title: "Configuring Notifications",
    description:
      "Complete guide to setting up notifications for all UniArr events",
    category: "configuration",
    type: "configuration",
    service: "general",
    tags: ["notifications", "alerts", "setup", "mobile"],
    featured: true,
    order: 20,
    lastUpdated: "2024-01-17T15:30:00Z",
    readTime: 18,
    difficulty: "intermediate",
    sections: [
      {
        id: "notification-types",
        title: "Notification Types",
        content: `# Notification Types

UniArr supports various notification types:

## Download Notifications

- Download completed alerts
- Download failure notifications
- Queue status changes

## Service Health Alerts

- Service offline notifications
- API connection errors
- Performance warnings

## Media Updates

- New media added
- Season premiere alerts
- Request status updates

## System Notifications

- App updates available
- Backup completion
- Storage space warnings`,
        order: 1,
      },
      {
        id: "mobile-notifications",
        title: "Mobile Notification Setup",
        content: `# Mobile Notification Setup

Configuring mobile notifications:

## iOS Setup

- Ensure notification permissions granted
- Check Focus/Do Not Disturb settings
- Verify app background refresh
- Configure notification sounds

## Android Setup

- Grant notification permissions
- Check Do Not Disturb mode
- Configure notification channels
- Set notification importance

## General Settings

- Configure quiet hours
- Set notification preferences
- Enable/disable specific types
- Customize notification content`,
        order: 2,
      },
      {
        id: "quiet-hours",
        title: "Quiet Hours Configuration",
        content: `# Quiet Hours Configuration

Setting up quiet hours:

## What are Quiet Hours?

Time periods when notifications are suppressed to avoid disturbances during sleep, work, or other activities.

## Configuration Options

- Set daily quiet hours (e.g., 10 PM - 7 AM)
- Different schedules for weekdays/weekends
- Override settings for urgent notifications
- Per-category quiet hour settings

## Emergency Bypass

- Service health alerts
- Security notifications
- Critical download failures
- System error notifications`,
        order: 3,
      },
    ],
    relatedResources: ["service-overview", "troubleshooting-notifications"],
  },
  {
    id: "widget-system-overview",
    title: "Complete Widget System Guide",
    description:
      "Comprehensive guide to UniArr's widget system with all 15 widget types and their features",
    category: "configuration",
    type: "configuration",
    service: "general",
    tags: ["widgets", "dashboard", "customization", "all-widgets"],
    featured: true,
    order: 21,
    lastUpdated: "2024-01-16T12:00:00Z",
    readTime: 35,
    difficulty: "intermediate",
    sections: [
      {
        id: "widget-architecture",
        title: "Widget System Architecture",
        content: `# Widget System Architecture

UniArr's widget system provides a comprehensive, extensible dashboard solution:

## Core Components

### WidgetContainer
- Central component rendering all enabled widgets
- Handles widget management, editing, and state
- Supports widget toggling, editing, and FAB-based interface
- Manages widget loading and refresh cycles

### WidgetService
- Singleton service managing widget configuration and data caching
- Handles widget persistence, ordering, and lifecycle
- Supports data caching with TTL and config-based cache invalidation
- Provides methods for widget CRUD operations and data management

### WidgetDrawerService
- Context-based service for content drawer functionality
- Manages modal dialogs for detailed content display
- Supports metadata, images, and action buttons

## Data Management Features

### Smart Caching System
- TTL-based caching with different expiration times per widget type
- Config signature-based cache invalidation
- Background data refresh without blocking UI
- Automatic cache cleanup for expired entries

### Offline Support
- Graceful degradation when offline
- Cached data display during network issues
- Retry mechanisms for failed requests
- Network-aware data fetching

## Performance Optimizations
- React Compiler integration for component optimization
- Memoized widget rendering
- Lazy loading for complex widgets
- Image caching and prefetching through ImageCacheService`,
        order: 1,
      },
      {
        id: "service-integration-widgets",
        title: "Service Integration Widgets",
        content: `# Service Integration Widgets

## ServiceStatusWidget
Monitors connection status and response times for all services

**Features:**
- Real-time online/offline status with visual indicators
- Configurable source modes (global or specific services)
- Shows only offline services option
- Response time monitoring and health checks

**Configuration Options:**
- Service selection (all or specific)
- Status update intervals
- Offline-only filtering
- Health check thresholds

**Use Cases:**
- Monitor service availability
- Identify connectivity issues
- Track service performance
- Quick status overview

## DownloadProgressWidget
Tracks active and completed downloads across services

**Features:**
- Real-time download progress tracking
- Speed and ETA information
- Configurable service filtering
- Completion status management

**Configuration Options:**
- Service-specific filtering
- Active vs completed downloads
- Update frequency
- Progress display format

**Use Cases:**
- Monitor download queue status
- Track download speeds
- Manage active downloads
- View completion history

## RecentActivityWidget
Displays recent imports and downloads across services

**Features:**
- Activity timeline with metadata
- Configurable source modes and service filtering
- Limit settings for activity display
- Timestamp and source tracking

**Configuration Options:**
- Activity type filtering (imports, downloads, all)
- Service selection
- Display limits (5-50 items)
- Time range filtering

**Use Cases:**
- Review recent system activity
- Track media additions
- Monitor download history
- Identify activity patterns

## StatisticsWidget
Provides library statistics and metadata insights

**Features:**
- Media counts and size distribution
- Configurable filtering by service and media type
- Visual representation of statistics
- Real-time data updates

**Configuration Options:**
- Service-specific stats
- Media type filtering
- Display format (counts, sizes, percentages)
- Update intervals

**Use Cases:**
- Library overview and management
- Storage capacity planning
- Media distribution analysis
- Performance monitoring`,
        order: 2,
      },
      {
        id: "calendar-media-widgets",
        title: "Calendar and Media Widgets",
        content: `# Calendar and Media Widgets

## CalendarPreviewWidget
Shows upcoming TV and movie releases

**Features:**
- Upcoming episode and movie releases
- Poster images with date information
- Configurable date range and item limits
- Service-specific filtering (Sonarr/Radarr)
- Clickable navigation to full calendar

**Configuration Options:**
- Date range selection (1-14 days)
- Item limits (3-20 releases)
- Service filtering (Sonarr only, Radarr only, both)
- Poster display options
- Click-to-navigate behavior

**Use Cases:**
- Quick preview of upcoming releases
- Season premiere tracking
- Movie release monitoring
- Calendar navigation shortcut`,
        order: 3,
      },
      {
        id: "navigation-shortcuts",
        title: "Navigation and Shortcuts",
        content: `# Navigation and Shortcuts

## ShortcutsWidget
Quick access to app sections and features

**Features:**
- Pre-configured navigation items
- Icon-based navigation with labels
- Customizable route configuration
- Quick access to main features

**Built-in Shortcuts:**
- Discover (media discovery and recommendations)
- Search (unified search across services)
- Calendar (release calendar view)
- Anime Hub (anime-specific content)

**Configuration Options:**
- Shortcut selection and ordering
- Icon customization
- Label display preferences
- Custom route addition

**Use Cases:**
- Quick navigation to frequently used features
- Personalized app shortcuts
- Efficient app navigation
- Feature accessibility improvement`,
        order: 4,
      },
      {
        id: "external-content-widgets",
        title: "External Content Widgets",
        content: `# External Content Widgets

## RssWidget
News headlines from RSS/Atom feeds

**Features:**
- RSS and Atom feed support
- Configurable feed URLs and article limits
- Image prefetching for performance
- Long-press for content drawer with article details
- Source attribution and timestamps

**Configuration Options:**
- Multiple feed URLs
- Article limits (5-25 items)
- Image prefetching settings
- Update intervals
- Content display options

**Use Cases:**
- News headline monitoring
- Blog updates tracking
- Tech news aggregation
- Custom content feeds

## RedditWidget
Reddit posts from configured subreddits

**Features:**
- Reddit posts from multiple subreddits
- Different sorting methods (hot, new, rising, top)
- Time range filtering for top posts
- Image preview modal integration
- Long-press content drawer with post details
- Score, author, comments, and timestamps

**Configuration Options:**
- Subreddit selection (up to 5 subreddits)
- Sorting method selection
- Time range for top posts
- Post limits (5-30 items)
- Content display preferences

**Use Cases:**
- Community news tracking
- Interest-based content discovery
- Discussion monitoring
- Social media integration

## HackerNewsWidget
Hacker News top stories and new posts

**Features:**
- Hacker News feed integration
- Multiple feed types (topstories, new, best, etc.)
- Limit settings for article display
- Integration with content drawer for full article view

**Configuration Options:**
- Feed type selection
- Article limits (5-25 items)
- Update intervals
- Content display settings

**Use Cases:**
- Tech news and updates
- Startup and industry news
- Developer community content
- Technology trends monitoring

## YouTubeWidget
YouTube channel upload monitoring

**Features:**
- YouTube channel upload tracking
- Requires YouTube Data API key
- Configurable channel IDs and item limits
- Per-channel item limits (2-3 items)
- Deep-link integration for YouTube app
- Thumbnail prefetching and caching

**Configuration Options:**
- YouTube Data API key configuration
- Channel ID addition (multiple channels supported)
- Per-channel item limits
- Update frequency
- Thumbnail quality settings

**Use Cases:**
- Favorite creator updates
- Content creator monitoring
- Video subscription alternative
- YouTube integration without subscriptions

## TwitchWidget
Twitch channel live status monitoring

**Features:**
- Twitch channel live status monitoring
- Requires Client ID and App Access Token
- Channel login configuration
- Live/offline status with viewer counts
- Customizable offline messages
- Quick channel links

**Configuration Options:**
- Twitch API credentials setup
- Channel login names
- Update intervals
- Status display preferences
- Offline message customization

**Use Cases:**
- Streamer status monitoring
- Live stream notifications
- Gaming content tracking
- Twitch community integration`,
        order: 5,
      },
      {
        id: "user-data-widgets",
        title: "User Data Widgets",
        content: `# User Data Widgets

## BookmarksWidget
Personal bookmark management

**Features:**
- Personal bookmark storage and organization
- Editable bookmark interface
- Navigation to full bookmark settings
- Quick access to saved content

**Configuration Options:**
- Bookmark categories
- Display preferences
- Edit mode access
- Navigation shortcuts

**Use Cases:**
- Quick access to important content
- Personal content organization
- Frequently used resources
- Custom bookmark collections`,
        order: 6,
      },
      {
        id: "utility-widgets",
        title: "Utility Widgets",
        content: `# Utility Widgets

## WeatherWidget
Local weather information and forecasts

**Features:**
- Device location or manual location configuration
- Unit preferences (metric/imperial)
- Forecast days configuration
- Location-based weather data
- Real-time weather updates

**Configuration Options:**
- Location source (device GPS or manual)
- Temperature units (Celsius/Fahrenheit)
- Forecast days (1-7 days)
- Update intervals
- Display format preferences

**Use Cases:**
- Daily weather monitoring
- Travel planning
- Activity scheduling
- Local weather awareness`,
        order: 7,
      },
    ],
  },
  {
    id: "widget-customization-guide",
    title: "Advanced Widget Customization",
    description:
      "Detailed guide to configuring, customizing, and managing your widget dashboard",
    category: "configuration",
    type: "configuration",
    service: "general",
    tags: ["widget-setup", "dashboard-customization", "widget-management"],
    featured: false,
    order: 22,
    lastUpdated: "2024-01-16T14:00:00Z",
    readTime: 30,
    difficulty: "intermediate",
    sections: [
      {
        id: "getting-started",
        title: "Getting Started with Widgets",
        content: `# Getting Started with Widgets

## Widget Editor Access

### Method 1: Long-Press Activation
- Long-press anywhere on the dashboard
- Enter edit mode
- Access widget management options

### Method 2: FAB Button
- Tap the floating action button (+) on dashboard
- Select "Add Widget" or "Manage Widgets"
- Access widget drawer and configuration

### Method 3: Settings Menu
- Navigate to Settings → Widgets
- Access comprehensive widget management
- Configure all widget settings in one place

## Adding Your First Widget

1. **Choose Widget Type**
   - Browse available widget categories
   - Read widget descriptions and features
   - Select widget that matches your needs

2. **Configure Basic Settings**
   - Set widget display name
   - Choose size (small, medium, large)
   - Configure data sources if applicable

3. **Position Widget**
   - Drag to desired location
   - Auto-arrange option available
   - Save layout changes

4. **Test Widget**
   - Verify data loading
   - Check refresh intervals
   - Test widget interactions`,
        order: 1,
      },
      {
        id: "widget-configuration",
        title: "Widget Configuration Details",
        content: `# Widget Configuration Details

## Service Integration Widgets Setup

### ServiceStatusWidget Configuration
- **Source Mode**: Global (all services) or specific services
- **Update Interval**: 30 seconds to 10 minutes
- **Show Offline Only**: Filter to show only problematic services
- **Response Time Thresholds**: Custom alert levels

### DownloadProgressWidget Settings
- **Service Selection**: qBittorrent, Sonarr, Radarr downloads
- **Filter Types**: Active downloads, completed, or both
- **Progress Display**: Percentage, speed, ETA options
- **Queue Limits**: Maximum items to display

### RecentActivityWidget Options
- **Activity Types**: Imports, downloads, manual additions
- **Service Filtering**: Per-service activity monitoring
- **Time Range**: Last hour, day, week options
- **Item Limits**: 5-50 recent activities

### StatisticsWidget Configuration
- **Metric Types**: File counts, storage sizes, percentages
- **Service Breakdown**: Individual service vs aggregate data
- **Visual Display**: Charts, graphs, or text-based
- **Update Frequency**: Real-time to hourly updates

## External Content Widgets Setup

### RSS Widget Configuration
- **Feed URLs**: Multiple RSS/Atom feed support
- **Article Limits**: 5-25 articles per feed
- **Image Caching**: Automatic thumbnail prefetching
- **Content Extraction**: Full article content vs summary

### Reddit Widget Settings
- **Subreddit Selection**: Up to 5 subreddits
- **Sorting Options**: Hot, new, rising, top posts
- **Time Range**: Hour, day, week, month, year, all time
- **NSFW Filtering**: Safe content filtering options

### YouTube Widget Setup
- **API Key**: YouTube Data API v3 key required
- **Channel IDs**: Multiple channel monitoring
- **Content Types**: Uploads, live streams, premieres
- **Thumbnail Quality**: Default, medium, high quality options

### Twitch Widget Configuration
- **API Credentials**: Client ID and App Access Token
- **Channel Logins**: Streamer usernames
- **Status Updates**: Live/offline monitoring
- **Viewer Count**: Real-time viewer statistics

## Utility Widgets Configuration

### Weather Widget Settings
- **Location Source**: Device GPS or manual coordinates
- **Units**: Metric (Celsius) or Imperial (Fahrenheit)
- **Forecast Days**: 1-7 day forecast options
- **Update Frequency**: Every 15 minutes to 6 hours

### Bookmarks Widget Setup
- **Bookmark Categories**: Custom category creation
- **Import/Export**: Backup and restore bookmarks
- **Quick Access**: One-tap bookmark navigation
- **Sharing Options**: Share bookmark collections`,
        order: 2,
      },
      {
        id: "widget-layout-management",
        title: "Layout and Visual Customization",
        content: `# Layout and Visual Customization

## Widget Size Options

### Small Widgets
- **Dimensions**: 2x2 grid units
- **Best For**: Quick status, simple data, shortcuts
- **Examples**: Weather, shortcuts, service status
- **Layout Fit**: 4-6 widgets per screen

### Medium Widgets
- **Dimensions**: 4x2 or 2x4 grid units
- **Best For**: Lists, detailed information, previews
- **Examples**: Recent activity, download progress, RSS
- **Layout Fit**: 2-4 widgets per screen

### Large Widgets
- **Dimensions**: 4x4 grid units
- **Best For**: Rich content, detailed views, calendars
- **Examples**: Calendar preview, statistics, YouTube
- **Layout Fit**: 1-2 widgets per screen

## Layout Management

### Drag and Drop Arrangement
- **Visual Feedback**: Widget shadows and guides during movement
- **Auto-Arrange**: Automatic grid alignment
- **Swap Positions**: Exchange widget locations
- **Multi-page**: Multiple dashboard pages support

### Layout Templates
- **Default Layout**: Balanced mix of widget sizes
- **Service Focus**: Emphasis on service status and downloads
- **Content Focus**: Emphasis on external content widgets
- **Minimal Layout**: Few essential widgets only

### Responsive Design
- **Screen Adaptation**: Automatic layout adjustment
- **Orientation Support**: Portrait and landscape layouts
- **Multi-device**: Consistent experience across devices
- **Dynamic Resizing**: Content adapts to widget size

## Theme and Styling

### Dark/Light Mode Support
- **System Theme**: Automatic theme detection
- **Manual Override**: User-selected theme preference
- **Widget Adaptation**: All widgets support theme switching
- **OLED Mode**: Pure black backgrounds for OLED devices

### Custom Color Schemes
- **Widget Backgrounds**: Solid colors or gradients
- **Text Colors**: High contrast readability
- **Accent Colors**: Highlight colors and indicators
- **Border Styles**: Subtle borders or full separation

### Font and Typography
- **Font Sizes**: Small, medium, large text options
- **Font Weights**: Regular, bold, heavy text styles
- **Text Alignment**: Left, center, right alignment
- **Line Heights**: Optimized readability settings`,
        order: 3,
      },
      {
        id: "advanced-features",
        title: "Advanced Widget Features",
        content: `# Advanced Widget Features

## Data Caching and Performance

### Intelligent Caching
- **TTL Management**: Time-to-live based cache expiration
- **Config Signatures**: Cache invalidation on configuration changes
- **Background Refresh**: Non-blocking data updates
- **Offline Support**: Cached data display when offline

### Cache Configuration per Widget Type
- **Service Widgets**: 30-60 second cache intervals
- **RSS Feeds**: 5-15 minute cache intervals
- **Social Media**: 10-30 minute cache intervals
- **Weather Data**: 15-60 minute cache intervals

### Performance Optimization
- **React Compiler Integration**: Automatic optimization
- **Image Caching**: Prefetched and cached thumbnails
- **Lazy Loading**: Widget content loads as needed
- **Memory Management**: Automatic cache cleanup

## Widget Interactions

### Long-Press Actions
- **Content Drawer**: Detailed view with extended information
- **Action Buttons**: External links, sharing options
- **Widget Settings**: Quick access to configuration
- **Remove/Disable**: Fast widget management

### Tap Actions
- **Navigation**: Deep-link to relevant app sections
- **External Links**: Open in web browser or native apps
- **Expand/Collapse**: Show more or less content
- **Refresh**: Manual data refresh

### Swipe Gestures
- **Refresh**: Pull-to-refresh functionality
- **Dismiss**: Swipe to dismiss notifications
- **Navigate**: Swipe between widget pages
- **Configure**: Swipe to access settings

## Integration Features

### Service Synchronization
- **Real-time Updates**: Live service data
- **Cross-Widget Data**: Shared data between widgets
- **Service Events**: Automatic updates on service changes
- **Error Handling**: Graceful service connectivity issues

### External Service Integration
- **API Authentication**: Secure API key management
- **Rate Limiting**: Respectful API usage
- **Error Recovery**: Automatic retry mechanisms
- **Data Validation**: Input sanitization and validation

### Notification Integration
- **Widget Notifications**: In-widget status changes
- **Push Notifications**: System-level alerts
- **Quiet Hours**: Respect notification preferences
- **Priority Levels**: Urgent vs informational updates`,
        order: 4,
      },
      {
        id: "troubleshooting-widgets",
        title: "Widget Troubleshooting",
        content: `# Widget Troubleshooting

## Common Widget Issues

### Data Loading Problems
- **Check Internet Connection**: Verify network connectivity
- **API Key Issues**: Validate API credentials
- **Service Status**: Check external service availability
- **Cache Issues**: Clear widget cache and refresh

### Configuration Problems
- **Invalid Settings**: Reset to default configuration
- **Permission Issues**: Check app permissions
- **API Limits**: Verify API rate limits not exceeded
- **Authentication Failures**: Re-enter service credentials

### Performance Issues
- **Memory Usage**: Reduce number of active widgets
- **Update Frequency**: Increase refresh intervals
- **Image Caching**: Limit image prefetching
- **Background Updates**: Disable background refresh

## Widget Reset and Recovery

### Individual Widget Reset
1. Long-press the problematic widget
2. Select "Reset Widget" from options
3. Confirm reset action
4. Reconfigure widget settings

### Full Widget System Reset
1. Navigate to Settings → Widgets
2. Select "Reset All Widgets"
3. Confirm reset action
4. Re-add and configure widgets

### Backup and Restore
- **Export Configuration**: Save widget layout and settings
- **Import Configuration**: Restore from backup file
- **Cloud Sync**: Sync widget settings across devices
- **Version History**: Rollback to previous configurations

## Debug Mode
- **Detailed Logs**: Enable verbose widget logging
- **Network Requests**: Monitor API calls and responses
- **Performance Metrics**: Track widget performance
- **Error Details**: View detailed error information`,
        order: 5,
      },
    ],
  },
  // API Reference
  {
    id: "dashboard-complete-guide",
    title: "Dashboard Complete Guide",
    description:
      "Comprehensive guide to the UniArr dashboard screen, features, and user experience",
    category: "getting-started",
    type: "guide",
    service: "general",
    tags: ["dashboard", "interface", "user-experience", "main-screen"],
    featured: true,
    order: 3,
    lastUpdated: "2024-01-16T16:00:00Z",
    readTime: 25,
    difficulty: "beginner",
    sections: [
      {
        id: "dashboard-overview",
        title: "Dashboard Screen Overview",
        content: `# Dashboard Screen Overview

The UniArr dashboard is your central command center for managing all media services and monitoring activity in real-time.

## Key Dashboard Features

### Animated Header
- **Gradient Backgrounds**: Beautiful animated gradients that adapt to your theme
- **Smooth Transitions**: Seamless animations between different states
- **Status Indicators**: Quick visual feedback for overall system health
- **Time and Date**: Current information display

### Widget Integration
- **Flexible Layout**: Drag-and-drop widget arrangement
- **Mixed Widget Sizes**: Small, medium, and large widgets coexist
- **Real-time Updates**: Live data from all connected services
- **Interactive Elements**: Tap, long-press, and swipe gestures

### Navigation System
- **Sticky Navigation Buttons**: Quick access to main features
- **Tab Bar Integration**: Seamless access to other app sections
- **Gesture Controls**: Swipe-based navigation and interactions
- **Contextual Actions**: Smart buttons based on current state`,
        order: 1,
      },
      {
        id: "dashboard-interactions",
        title: "Dashboard Interactions and Gestures",
        content: `# Dashboard Interactions and Gestures

## Touch Gestures

### Long-Press (Edit Mode)
- **Activate Edit Mode**: Long-press anywhere on dashboard
- **Widget Management**: Reorder, resize, or remove widgets
- **Add Widgets**: Access widget drawer and selection
- **Save Layout**: Confirm changes and exit edit mode

### Tap Actions
- **Widget Interaction**: Single tap triggers widget-specific actions
- **Content Navigation**: Navigate to detailed views
- **External Links**: Open web content in browser
- **Settings Access**: Quick access to widget settings

### Swipe Gestures
- **Refresh Content**: Pull-to-refresh for dashboard data
- **Widget Pages**: Swipe between multiple dashboard pages
- **Dismiss Notifications**: Swipe to clear alerts
- **Quick Actions**: Swipe for context-sensitive options

## Widget Drawer Interactions

### Adding Widgets
1. **Access Widget Drawer**: Tap + button or long-press dashboard
2. **Browse Categories**: Service, content, utility, and external widgets
3. **Preview Widget**: See widget description and features
4. **Configure Widget**: Set up widget-specific settings
5. **Position Widget**: Drag to desired location on dashboard

### Managing Widgets
- **Reorder**: Drag widgets to new positions
- **Resize**: Choose small, medium, or large sizes
- **Configure**: Access widget-specific settings
- **Remove**: Delete widgets from dashboard

### Widget Settings Access
- **Long-Press Widget**: Quick access to widget settings
- **Settings Menu**: Comprehensive widget configuration
- **Reset Options**: Reset individual or all widgets
- **Backup/Restore**: Save and restore widget layouts`,
        order: 2,
      },
      {
        id: "dashboard-personalization",
        title: "Dashboard Personalization",
        content: `# Dashboard Personalization

## Layout Customization

### Widget Arrangement
- **Drag-and-Drop**: Intuitive widget positioning
- **Grid System**: Automatic alignment and spacing
- **Multi-page Support**: Multiple dashboard pages
- **Layout Templates**: Pre-configured widget arrangements

### Size and Scale
- **Small Widgets**: 2x2 grid for compact information
- **Medium Widgets**: 4x2 or 2x4 for detailed content
- **Large Widgets**: 4x4 for rich, interactive content
- **Dynamic Sizing**: Content adapts to widget dimensions

### Visual Themes
- **Dark/Light Mode**: Automatic theme detection
- **Custom Colors**: Personalized color schemes
- **Widget Themes**: Individual widget styling options
- **OLED Optimization**: Pure black backgrounds for OLED devices

## Content Personalization

### Service-Specific Content
- **Selected Services**: Show data from chosen services only
- **Filtered Views**: Display specific types of content
- **Custom Ranges**: Configure date ranges and limits
- **Update Intervals**: Set refresh frequencies per widget

### External Content
- **Personal Feeds**: Add your favorite RSS feeds
- **Social Media**: Configure Reddit, YouTube, Twitch
- **News Sources**: Select tech news and headlines
- **Weather Data**: Local weather and forecasts

### Quick Actions
- **Custom Shortcuts**: Add navigation shortcuts
- **Frequent Features**: Quick access to most-used functions
- **Service Actions**: Direct service controls
- **External Links**: Quick access to web resources`,
        order: 3,
      },
      {
        id: "dashboard-performance",
        title: "Dashboard Performance and Optimization",
        content: `# Dashboard Performance and Optimization

## Performance Features

### React Compiler Integration
- **Automatic Optimization**: Compiler optimizes widget rendering
- **Memoization**: Prevents unnecessary re-renders
- **Performance Monitoring**: Tracks component performance
- **Optimization Suggestions**: Compiler provides improvement tips

### Smart Caching
- **Widget Data Caching**: TTL-based caching per widget type
- **Image Caching**: Prefetched and cached thumbnails
- **Configuration Caching**: Store widget settings efficiently
- **Background Updates**: Non-blocking data refresh

### Memory Management
- **Lazy Loading**: Widget content loads as needed
- **Cache Cleanup**: Automatic expired cache removal
- **Memory Monitoring**: Track memory usage patterns
- **Performance Metrics**: Built-in performance tracking

## Battery Optimization

### Efficient Updates
- **Configurable Intervals**: Balance freshness and battery usage
- **Network Awareness**: Reduce updates during poor connectivity
- **Background Limits**: Control background data usage
- **Sleep Mode**: Respect device battery optimization

### Smart Refresh
- **Batch Updates**: Combine multiple widget updates
- **Priority Systems**: Important widgets update first
- **User Activity**: Adapt to user interaction patterns
- **Power States**: Adjust behavior based on power levels

## Network Optimization

### Data Efficiency
- **Compressed Data**: Minimize data transfer
- **Delta Updates**: Only transfer changed data
- **Connection Types**: Adapt to WiFi vs mobile data
- **Offline Support**: Graceful offline functionality

### Request Management
- **Rate Limiting**: Respect API limits and quotas
- **Retry Logic**: Smart retry for failed requests
- **Error Handling**: Graceful degradation on errors
- **Request Batching**: Combine multiple API requests`,
        order: 4,
      },
      {
        id: "dashboard-workflows",
        title: "Dashboard Workflows and Use Cases",
        content: `# Dashboard Workflows and Use Cases

## Common User Workflows

### Daily Media Check
1. **Open Dashboard**: View service status at a glance
2. **Check Downloads**: Monitor active download progress
3. **Review Activity**: See recent imports and additions
4. **Check Calendar**: Preview upcoming releases
5. **Manage Queue**: Adjust download priorities

### Service Health Monitoring
1. **Status Overview**: Check all service connection status
2. **Response Times**: Monitor service performance
3. **Error Identification**: Quickly identify offline services
4. **Troubleshooting**: Access diagnostic tools
5. **Service Management**: Restart or reconfigure services

### Content Discovery
1. **News Updates**: Review RSS and social media feeds
2. **Recommendations**: Check discovery features
3. **Trending Content**: Monitor popular media
4. **Request Management**: Handle media requests
5. **Library Updates**: Review new additions

### System Administration
1. **Storage Monitoring**: Check disk space usage
2. **Performance Metrics**: Review system performance
3. **Backup Status**: Monitor backup operations
4. **Update Management**: Check for app updates
5. **Configuration Review**: Validate system settings

## Advanced Dashboard Uses

### Multi-Service Management
- **Centralized Control**: Manage all services from one interface
- **Cross-Service Workflows**: Coordinate actions between services
- **Unified Monitoring**: Single view of all service health
- **Aggregated Analytics**: Combined statistics and insights

### Automation Integration
- **Scheduled Tasks**: Automate routine dashboard operations
- **Event-Driven Actions**: Trigger actions based on dashboard events
- **Notification Workflows**: Custom notification rules and actions
- **API Integration**: Connect dashboard to external systems

### Mobile-First Usage
- **Quick Glances**: Brief dashboard checks throughout the day
- **On-the-Go Management**: Manage services while mobile
- **Touch-Optimized**: Designed for mobile touch interfaces
- **Offline Capability**: Access dashboard data without internet`,
        order: 5,
      },
    ],
    relatedResources: ["widget-system-overview", "getting-started-uniarr"],
  },
  // API Reference
  {
    id: "service-api-reference",
    title: "Service API Reference",
    description: "Comprehensive API documentation for all supported services",
    category: "api-reference",
    type: "api-doc",
    service: "general",
    tags: ["api", "documentation", "endpoints", "integration"],
    featured: false,
    order: 40,
    lastUpdated: "2024-01-14T10:15:00Z",
    readTime: 30,
    difficulty: "advanced",
    sections: [
      {
        id: "api-overview",
        title: "API Integration Overview",
        content: `# API Integration Overview

UniArr integrates with service APIs to provide:

## Data Retrieval

- Service status and health
- Library and collection data
- Queue and download information
- Configuration and settings

## Actions and Control

- Start/stop downloads
- Approve/deny requests
- Modify service settings
- Trigger operations

## Real-time Updates

- Webhook support
- Event notifications
- Status changes
- Progress updates`,
        order: 1,
      },
      {
        id: "authentication",
        title: "API Authentication",
        content: `# API Authentication

Authentication methods for service APIs:

## API Key Authentication

- Service-specific API keys
- Header-based authentication
- Query parameter authentication

## Token-based Authentication

- JWT tokens
- OAuth integration
- Service-specific tokens

## Basic Authentication

- Username/password combinations
- HTTP Basic Auth headers
- Service account credentials`,
        order: 2,
      },
      {
        id: "endpoints",
        title: "Complete API Reference",
        content: `# Complete API Reference

Comprehensive API endpoints and authentication for all supported services:

## Media Management APIs

### Sonarr (TV Shows)
- **Authentication**: API Key header
- **Base URL**: http://localhost:8989/api/v3
- **Key Endpoints**:
  - GET /system/status - Service health and version
  - GET /queue - Download queue status
  - GET /series - Series library management
  - GET /episode - Episode information
  - POST /command - Execute commands
  - GET /calendar - Release calendar data

### Radarr (Movies)
- **Authentication**: API Key header
- **Base URL**: http://localhost:7878/api/v3
- **Key Endpoints**:
  - GET /system/status - Service health and version
  - GET /queue - Download queue management
  - GET /movie - Movie library
  - GET /movie/{id} - Movie details
  - POST /command - Execute commands
  - GET /calendar - Upcoming releases

### Lidarr (Music)
- **Authentication**: API Key header
- **Base URL**: http://localhost:8686/api/v1
- **Key Endpoints**:
  - GET /system/status - Service health
  - GET /artist - Artist library
  - GET /album - Album management
  - GET /track - Track information
  - GET /queue - Download queue
  - GET /wanted/missing - Missing albums/tracks

## Media Server APIs

### Jellyfin (Media Server)
- **Authentication**: API Key header
- **Base URL**: http://localhost:8096
- **Key Endpoints**:
  - GET /Users - User management
  - GET /Users/{userId}/Items - Library browsing
  - GET /Users/{userId}/Items/{itemId} - Item details
  - POST /Videos/{itemId}/Playback - Stream playback
  - GET /Library/Options - Library configuration

## Download Client APIs

### qBittorrent (Torrents)
- **Authentication**: Cookie-based session
- **Base URL**: http://localhost:8080/api/v2
- **Key Endpoints**:
  - GET /torrents - Torrent list and management
  - POST /torrents/add - Add torrents
  - POST /torrents/pause - Pause torrents
  - POST /torrents/resume - Resume torrents
  - GET /transfer/info - Transfer statistics
  - GET /app/version - Application version

### Transmission (Torrents)
- **Authentication**: Session-based (X-Transmission-Session-Id)
- **Base URL**: http://localhost:9091/transmission/rpc
- **Key Methods**:
  - torrent-get - Get torrent information
  - torrent-add - Add new torrents
  - torrent-start/stop/pause - Torrent control
  - session-get - Session statistics
  - session-set - Configure transmission

### SABnzbd (Usenet)
- **Authentication**: API Key parameter
- **Base URL**: http://localhost:8080/sabnzbd/api
- **Key Endpoints**:
  - &mode=queue - Queue management
  - &mode=history - Download history
  - &mode=addfile - Add NZB files
  - &mode=pause/resume - Queue control
  - &mode=status - Service status

### Deluge (Torrents)
- **Authentication**: JSON-RPC with session cookie
- **Base URL**: http://localhost:8112/json
- **Key Methods**:
  - web.update_ui - Get torrent list
  - core.add_torrent_url - Add torrent
  - core.pause/resume - Torrent control
  - core.get_torrent_status - Torrent details
  - web.get_torrents - Torrent management

## Enhancement Service APIs

### Bazarr (Subtitles)
- **Authentication**: API Key header
- **Base URL**: http://localhost:6767/api
- **Key Endpoints**:
  - GET /movies/subtitles - Movie subtitles
  - GET /series/subtitles - TV show subtitles
  - POST /movies/subtitles/search - Search subtitles
  - POST /series/subtitles/search - Search TV subtitles
  - GET /system/status - Service status

### Prowlarr (Indexers)
- **Authentication**: API Key header
- **Base URL**: http://localhost:9696/api/v1
- **Key Endpoints**:
  - GET /indexer - Indexer management
  - GET /app/profiles - Application profiles
  - GET /search - Search across indexers
  - GET /history - Search history
  - GET /health - Service health checks

### AdGuard Home (DNS)
- **Authentication**: Basic auth or API key
- **Base URL**: http://localhost:3000/control
- **Key Endpoints**:
  - GET /status - Protection status
  - GET /querylog - DNS query logs
  - GET /stats - Usage statistics
  - POST /dns_info - DNS configuration
  - GET /access/list - Client management

### TMDB (Media Database)
- **Authentication**: API v3 key or v4 Bearer token
- **Base URL**: https://api.themoviedb.org/3
- **Key Endpoints**:
  - GET /search/movie - Movie search
  - GET /search/tv - TV show search
  - GET /movie/{id} - Movie details
  - GET /tv/{id} - TV show details
  - GET /trending/all/day - Trending content

## Request Management APIs

### Jellyseerr (Media Requests)
- **Authentication**: API Key header
- **Base URL**: http://localhost:5055/api/v1
- **Key Endpoints**:
  - GET /request - Request management
  - POST /request - Create new request
  - GET /user - User information
  - GET /movie/discover - Movie discovery
  - GET /tv/discover - TV show discovery`,
        order: 3,
      },
    ],
    links: [
      {
        title: "Sonarr API Documentation",
        url: "https://wiki.servarr.com/sonarr/api",
        type: "external",
        description: "Official Sonarr API reference",
      },
      {
        title: "Radarr API Documentation",
        url: "https://wiki.servarr.com/radarr/api",
        type: "external",
        description: "Official Radarr API reference",
      },
    ],
  },
  // Advanced Features
  {
    id: "voice-assistant-setup",
    title: "Voice Assistant Integration",
    description:
      "Setting up Siri and Google Assistant with UniArr for voice control",
    category: "advanced-features",
    type: "guide",
    service: "general",
    tags: ["voice", "siri", "google-assistant", "automation"],
    featured: true,
    order: 50,
    lastUpdated: "2024-01-19T09:00:00Z",
    readTime: 22,
    difficulty: "advanced",
    sections: [
      {
        id: "voice-intro",
        title: "Voice Assistant Overview",
        content: `# Voice Assistant Overview

UniArr supports voice commands through:

## Siri Integration (iOS)

- Siri Shortcuts support
- Custom voice commands
- Natural language processing
- HomeKit integration

## Google Assistant (Android)

- Google Assistant Actions
- Custom voice commands
- Routines integration
- Smart Home integration

## Supported Commands

- Check download status
- Start/stop downloads
- Add media to watchlist
- Get service status updates
- Request new media`,
        order: 1,
      },
      {
        id: "siri-setup",
        title: "Siri Shortcuts Setup",
        content: `# Siri Shortcuts Setup

Setting up Siri integration:

## 1. Enable Siri in UniArr

- Go to Settings → Voice Assistant
- Enable Siri Shortcuts
- Configure authentication

## 2. Create Custom Shortcuts

- Use Shortcuts app on iOS
- Record custom phrases
- Set up parameter passing

## 3. Test Commands

- "Hey Siri, check my downloads"
- "Hey Siri, what's downloading?"
- "Hey Siri, add movie to watchlist"

## 4. Advanced Features

- Multi-step routines
- Conditional responses
- Personalized suggestions`,
        order: 2,
      },
      {
        id: "google-assistant",
        title: "Google Assistant Setup",
        content: `# Google Assistant Setup

Configuring Google Assistant:

## 1. Enable Assistant in UniArr

- Navigate to Settings → Voice Assistant
- Select Google Assistant
- Link your Google account
- Grant necessary permissions

## 2. Create Custom Actions

- Use Google Assistant Actions console
- Define voice commands
- Set up webhook endpoints
- Configure response templates

## 3. Test Your Commands

- "Hey Google, check UniArr downloads"
- "Hey Google, pause downloads in UniArr"
- "Hey Google, what's on my watchlist?"

## 4. Create Routines

- Combine multiple actions
- Set triggers and conditions
- Customize responses

## 5. Enable Additional Features

- Contextual awareness
- Location-based triggers
- Time-based automations

> **Pro tip**: Start with simple commands and gradually build more complex routines as you become familiar with the system.`,
        order: 3,
      },
      {
        id: "voice-commands",
        title: "Available Voice Commands",
        content: `# Available Voice Commands

Complete list of supported voice commands:

## Download Management

- "Check my downloads"
- "What's downloading?"
- "Pause/resume downloads"
- "Show download queue"
- "Clear completed downloads"

## Service Status

- "Check service health"
- "Is Sonarr running?"
- "Show Radarr status"
- "Service diagnostics"

## Media Management

- "Add movie to watchlist"
- "Request TV show"
- "What's on my watchlist?"
- "Check upcoming releases"
- "Show new releases"

## Notifications

- "Check recent notifications"
- "Clear notifications"
- "Enable/disable notifications"`,
        order: 4,
      },
      {
        id: "troubleshooting",
        title: "Voice Assistant Troubleshooting",
        content: `# Voice Assistant Troubleshooting

Common voice assistant issues:

## Siri Issues

- Ensure Shortcuts app permissions
- Check internet connectivity
- Verify voice recognition accuracy
- Update iOS to latest version

## Google Assistant Issues

- Check Google account linkage
- Verify Assistant permissions
- Test with simpler commands
- Update Google Assistant app

## General Issues

- Check microphone permissions
- Verify internet connection
- Restart voice assistant service
- Clear cache and try again`,
        order: 5,
      },
    ],
    relatedResources: ["notification-setup", "getting-started-uniarr"],
    links: [
      {
        title: "Siri Shortcuts Documentation",
        url: "https://support.apple.com/en-us/guide/shortcuts/apd616c4cf4/ic",
        type: "external",
        description: "Apple's official Siri Shortcuts guide",
      },
      {
        title: "Google Assistant Actions",
        url: "https://developers.google.com/assistant",
        type: "external",
        description: "Google Assistant development resources",
      },
    ],
  },
  // Additional resources for better coverage
  {
    id: "backup-restore-guide",
    title: "Backup and Restore Guide",
    description:
      "Complete guide to backing up and restoring UniArr settings and data",
    category: "configuration",
    type: "guide",
    service: "general",
    tags: ["backup", "restore", "data-protection", "migration"],
    featured: false,
    order: 22,
    lastUpdated: "2024-01-15T11:30:00Z",
    readTime: 20,
    difficulty: "intermediate",
    sections: [
      {
        id: "backup-overview",
        title: "Backup Overview",
        content: `# Backup Overview

UniArr backup system protects:

## Settings and Preferences

- App configuration
- Service connections
- User preferences
- Theme settings

## Data and Progress

- Reading progress
- Bookmarks
- Download history
- Widget configurations

## Backup Types

- Local device backups
- Cloud storage backups
- Manual exports
- Scheduled automatic backups`,
        order: 1,
      },
      {
        id: "creating-backups",
        title: "Creating Backups",
        content: `# Creating Backups

How to create backups:

## 1. Manual Backup

- Go to Settings → Backup & Restore
- Tap "Create Backup"
- Choose backup options
- Save to device or cloud

## 2. Scheduled Backups

- Enable automatic backups
- Set backup frequency
- Choose backup location
- Configure retention policy

## 3. Export Configuration

- Export settings as JSON
- Save service configurations
- Export widget layouts
- Download backup file`,
        order: 2,
      },
    ],
  },
  {
    id: "network-diagnostics",
    title: "Network Diagnostics Tools",
    description:
      "Using UniArr's built-in network diagnostics for troubleshooting",
    category: "troubleshooting",
    type: "guide",
    service: "general",
    tags: ["network", "diagnostics", "troubleshooting", "tools"],
    featured: false,
    order: 32,
    lastUpdated: "2024-01-20T08:45:00Z",
    readTime: 15,
    difficulty: "advanced",
    sections: [
      {
        id: "diagnostic-tools",
        title: "Built-in Diagnostic Tools",
        content: `# Built-in Diagnostic Tools

UniArr provides network diagnostics:

## Connectivity Tests

- Service reachability checks
- API endpoint testing
- Response time measurement
- SSL certificate validation

## Network Analysis

- IP address detection
- DNS resolution testing
- Port scanning capabilities
- VPN detection

## Performance Monitoring

- Bandwidth testing
- Latency measurement
- Packet loss detection
- Connection stability tests`,
        order: 1,
      },
      {
        id: "using-diagnostics",
        title: "Running Diagnostics",
        content: `# Running Diagnostics

How to use diagnostic tools:

## 1. Access Diagnostics

- Go to Settings → Debugging
- Select "Network Diagnostics"
- Choose test type

## 2. Run Tests

- Individual service tests
- Full network scan
- Custom endpoint testing

## 3. Interpret Results

- Connection status indicators
- Response time metrics
- Error details and suggestions
- Historical comparison`,
        order: 2,
      },
    ],
  },
];

// Create the Zustand store
export const useResourcesStore = create<ResourcesState>()(
  persist(
    (set, get) => ({
      // Initial state
      resources: sampleResources,
      progress: {},
      bookmarks: [],
      favorites: [],
      viewCount: {},
      selectedCategory: undefined,
      selectedService: undefined,
      searchQuery: "",
      showFeaturedOnly: false,
      viewPreference: "expanded" as const,

      // Computed getters
      getFilteredResources: (filter = {}) => {
        const {
          resources,
          selectedCategory,
          selectedService,
          searchQuery,
          showFeaturedOnly,
        } = get();

        return resources
          .filter((resource) => {
            // Apply passed filter overrides
            const category = filter.category ?? selectedCategory;
            const service = filter.service ?? selectedService;
            const search = filter.searchQuery ?? searchQuery;
            const featured = filter.featured ?? showFeaturedOnly;
            const tags = filter.tags;

            // Category filter
            if (category && resource.category !== category) return false;

            // Service filter
            if (service && resource.service !== service) return false;

            // Featured filter
            if (featured && !resource.featured) return false;

            // Tags filter
            if (tags && tags.length > 0) {
              const hasMatchingTag = tags.some((tag) =>
                resource.tags.includes(tag.toLowerCase()),
              );
              if (!hasMatchingTag) return false;
            }

            // Search query
            if (search) {
              const searchLower = search.toLowerCase();
              const matchesSearch =
                resource.title.toLowerCase().includes(searchLower) ||
                resource.description.toLowerCase().includes(searchLower) ||
                resource.tags.some((tag) =>
                  tag.toLowerCase().includes(searchLower),
                );
              if (!matchesSearch) return false;
            }

            return true;
          })
          .sort((a, b) => a.order - b.order);
      },

      getResourceById: (id: string) => {
        const { resources } = get();
        return resources.find((resource) => resource.id === id);
      },

      getProgressForResource: (resourceId: string) => {
        const { progress } = get();
        return progress[resourceId];
      },

      getStats: () => {
        const { resources, progress } = get();

        const stats: ResourceStats = {
          totalResources: resources.length,
          completedResources: 0,
          totalTimeSpent: 0,
          categoryProgress: {} as Record<
            ResourceCategory,
            { total: number; completed: number }
          >,
          serviceProgress: {} as Record<
            ServiceType,
            { total: number; completed: number }
          >,
        };

        // Initialize category and service progress
        const categories: ResourceCategory[] = [
          "getting-started",
          "service-guides",
          "api-reference",
          "troubleshooting",
          "configuration",
          "advanced-features",
        ];
        const services: ServiceType[] = [
          "general",
          "sonarr",
          "radarr",
          "lidarr",
          "jellyseerr",
          "qbittorrent",
          "transmission",
          "sabnzbd",
          "deluge",
          "prowlarr",
          "jellyfin",
          "bazarr",
          "adguard",
          "tmdb",
        ];

        categories.forEach((category) => {
          stats.categoryProgress[category] = { total: 0, completed: 0 };
        });

        services.forEach((service) => {
          stats.serviceProgress[service] = { total: 0, completed: 0 };
        });

        // Calculate statistics
        resources.forEach((resource) => {
          // Category stats
          stats.categoryProgress[resource.category].total++;

          // Service stats
          if (resource.service) {
            stats.serviceProgress[resource.service].total++;
          }

          // Progress stats
          const resourceProgress = progress[resource.id];
          if (resourceProgress?.completed) {
            stats.completedResources++;
            stats.categoryProgress[resource.category].completed++;
            if (resource.service) {
              stats.serviceProgress[resource.service].completed++;
            }
          }

          if (resourceProgress) {
            stats.totalTimeSpent += resourceProgress.timeSpent;
          }
        });

        return stats;
      },

      getBookmarksForResource: (resourceId: string) => {
        const { bookmarks } = get();
        return bookmarks.filter(
          (bookmark) => bookmark.resourceId === resourceId,
        );
      },

      getFavoriteResources: () => {
        const { resources, favorites } = get();
        return resources.filter((r) => favorites.includes(r.id));
      },

      getRelatedResources: (resourceId: string) => {
        const { resources, getResourceById } = get();
        const resource = getResourceById(resourceId);
        if (!resource) return [];

        // Find resources with similar category or tags
        return resources.filter(
          (r) =>
            r.id !== resourceId &&
            (r.category === resource.category ||
              resource.tags?.some((tag) => r.tags.includes(tag)) ||
              resource.relatedResources?.includes(r.id)),
        );
      },

      // Actions
      updateProgress: (
        resourceId: string,
        progressUpdate: Partial<ResourceProgress>,
      ) => {
        set((state) => {
          const currentProgress = state.progress[resourceId] || {
            resourceId,
            completed: false,
            sectionsCompleted: [],
            lastAccessed: new Date().toISOString(),
            timeSpent: 0,
          };

          const updatedProgress = {
            ...currentProgress,
            ...progressUpdate,
            lastAccessed: new Date().toISOString(),
          };

          return {
            progress: {
              ...state.progress,
              [resourceId]: updatedProgress,
            },
          };
        });
      },

      markSectionCompleted: (resourceId: string, sectionId: string) => {
        set((state) => {
          const currentProgress = state.progress[resourceId] || {
            resourceId,
            completed: false,
            sectionsCompleted: [],
            lastAccessed: new Date().toISOString(),
            timeSpent: 0,
          };

          const sectionsCompleted = currentProgress.sectionsCompleted.includes(
            sectionId,
          )
            ? currentProgress.sectionsCompleted
            : [...currentProgress.sectionsCompleted, sectionId];

          const resource = state.resources.find((r) => r.id === resourceId);
          const completed = resource
            ? sectionsCompleted.length === resource.sections.length
            : false;

          return {
            progress: {
              ...state.progress,
              [resourceId]: {
                ...currentProgress,
                sectionsCompleted,
                completed,
                lastAccessed: new Date().toISOString(),
              },
            },
          };
        });
      },

      markResourceCompleted: (resourceId: string) => {
        set((state) => {
          const resource = state.resources.find((r) => r.id === resourceId);
          const sectionsCompleted = resource
            ? resource.sections.map((s) => s.id)
            : [];

          return {
            progress: {
              ...state.progress,
              [resourceId]: {
                resourceId,
                completed: true,
                sectionsCompleted,
                lastAccessed: new Date().toISOString(),
                timeSpent: state.progress[resourceId]?.timeSpent || 0,
              },
            },
          };
        });
      },

      addBookmark: (resourceId: string, sectionId?: string, note?: string) => {
        set((state) => {
          const existingBookmarkIndex = state.bookmarks.findIndex(
            (bookmark) =>
              bookmark.resourceId === resourceId &&
              bookmark.sectionId === sectionId,
          );

          if (existingBookmarkIndex >= 0) {
            // Update existing bookmark
            const updatedBookmarks = [...state.bookmarks];
            const existingBookmark = updatedBookmarks[existingBookmarkIndex];
            if (existingBookmark) {
              updatedBookmarks[existingBookmarkIndex] = {
                ...existingBookmark,
                note: note || existingBookmark.note,
                created: new Date().toISOString(),
              };
            }
            return { bookmarks: updatedBookmarks };
          } else {
            // Add new bookmark
            const newBookmark: ResourceBookmark = {
              resourceId,
              sectionId,
              created: new Date().toISOString(),
              note,
            };
            return {
              bookmarks: [...state.bookmarks, newBookmark],
            };
          }
        });
      },

      removeBookmark: (resourceId: string, sectionId?: string) => {
        set((state) => ({
          bookmarks: state.bookmarks.filter(
            (bookmark) =>
              !(
                bookmark.resourceId === resourceId &&
                bookmark.sectionId === sectionId
              ),
          ),
        }));
      },

      toggleFavorite: (resourceId: string) => {
        set((state) => {
          const isFav = state.favorites.includes(resourceId);
          return {
            favorites: isFav
              ? state.favorites.filter((id) => id !== resourceId)
              : [...state.favorites, resourceId],
          };
        });
      },

      isFavorited: (resourceId: string) => {
        const { favorites } = get();
        return favorites.includes(resourceId);
      },

      incrementViewCount: (resourceId: string) => {
        set((state) => ({
          viewCount: {
            ...state.viewCount,
            [resourceId]: (state.viewCount[resourceId] || 0) + 1,
          },
        }));
      },

      setFilter: (filter) => {
        set((state) => ({
          selectedCategory: filter.category ?? state.selectedCategory,
          selectedService: filter.service ?? state.selectedService,
          searchQuery: filter.searchQuery ?? state.searchQuery,
          showFeaturedOnly: filter.showFeaturedOnly ?? state.showFeaturedOnly,
        }));
      },

      setViewPreference: (preference: "compact" | "expanded") => {
        set({ viewPreference: preference });
      },

      resetProgress: () => {
        set({
          progress: {},
          bookmarks: [],
          favorites: [],
          viewCount: {},
        });
      },
    }),
    {
      name: "resources-store",
      storage: createJSONStorage(() => storageAdapter),
      partialize: (state) => ({
        progress: state.progress,
        bookmarks: state.bookmarks,
        favorites: state.favorites,
        viewCount: state.viewCount,
        selectedCategory: state.selectedCategory,
        selectedService: state.selectedService,
        showFeaturedOnly: state.showFeaturedOnly,
        viewPreference: state.viewPreference,
      }),
    },
  ),
);
