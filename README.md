# Paper2MD

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)
[![License](https://img.shields.io/badge/License-AGPL--3.0-blue?style=flat-square)](LICENSE)

[English](README.md) | [简体中文](doc/README-zhCN.md)

A Zotero 7 plugin that converts PDF papers to Markdown format using the MinerU API service.

## Features

- **PDF to Markdown Conversion**: Convert academic PDF papers to well-formatted Markdown files
- **MinerU API Integration**: Leverages the powerful MinerU document parsing service for accurate conversion
- **Smart PDF Selection**: Automatically identifies the original PDF when multiple versions exist (e.g., translated versions)
- **Image Extraction**: Extracts images from PDF and saves them in an organized `images/` folder
- **Metadata Injection**: Automatically adds YAML front matter with paper metadata (title, authors, year, DOI, tags)
- **Conversion Tagging**: Adds "已转换Markdown" tag to converted items for easy tracking
- **Progress Feedback**: Real-time progress indication during conversion
- **Multi-language Support**: Interface available in English and Chinese

## Installation

1. Download the latest `.xpi` file from [Releases](https://github.com/Ming-321/zotero-paper2md/releases)
2. In Zotero, go to `Tools` → `Add-ons`
3. Click the gear icon and select `Install Add-on From File...`
4. Select the downloaded `.xpi` file

## Configuration

1. In Zotero, go to `Edit` → `Settings` → `Paper2MD`
2. Enter your MinerU API Key (get it from [https://mineru.net](https://mineru.net))
3. (Optional) Modify the API URL if you have a custom endpoint

## Usage

1. Select a literature item with a PDF attachment in Zotero
2. Right-click and select **"Convert to Markdown"**
3. Wait for the conversion to complete
4. The Markdown file and images will be saved in the same folder as the original PDF

### Output Structure

```
Zotero/storage/XXXXXXXX/
├── paper.pdf           # Original PDF
├── paper.md            # Converted Markdown
└── images/             # Extracted images
    ├── 001.png
    ├── 002.jpg
    └── ...
```

### Markdown Format

The generated Markdown includes a YAML front matter:

```markdown
---
title: "Paper Title"
authors:
  - "Author One"
  - "Author Two"
year: 2024
doi: "10.xxx/xxx"
tags:
  - "tag1"
  - "tag2"
zotero_key: "XXXXXXXX"
source: "MinerU"
converted_at: "2024-01-01T12:00:00Z"
---

(Paper content...)
```

## Requirements

- Zotero 7
- MinerU API Key (free tier available at [mineru.net](https://mineru.net))

## Roadmap

### Phase 2 (Planned)
- Chapter-based intelligent summarization
- AI-powered reading notes generation
- Register summary notes as Zotero attachments

## Changelog

### v0.1.0 (2026-01-19)
- Initial release
- PDF to Markdown conversion using MinerU API
- Smart PDF selection (excludes translated versions)
- Image extraction with sequential naming (001.jpg, 002.png...)
- YAML front matter with metadata
- "已转换Markdown" tag for converted items
- Progress feedback during conversion
- Chinese and English interface

## Development

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm start

# Build for production
npm run build
```

## License

This project is licensed under the AGPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template)
- [MinerU](https://mineru.net) for the document parsing API
- [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit)
