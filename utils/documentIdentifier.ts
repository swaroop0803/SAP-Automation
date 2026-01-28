import * as fs from 'fs';
import * as path from 'path';

// Document type result interface
export interface DocumentTypeResult {
    type: string;           // e.g., "purchaseOrder", "materialDocument", "supplierInvoice"
    label: string;          // e.g., "Purchase Order", "Material Document"
    shortLabel: string;     // e.g., "PO", "Mat Doc", "Invoice"
    isValid: boolean;       // true if matched, false if unknown
}

// Config structure
interface PrefixConfig {
    codes: string[];
    label: string;
    shortLabel: string;
}

interface DocumentPrefixesConfig {
    prefixes: {
        [key: string]: PrefixConfig;
    };
}

// Cache for config to avoid repeated file reads
let configCache: DocumentPrefixesConfig | null = null;

/**
 * Load the document prefixes configuration
 */
function loadConfig(): DocumentPrefixesConfig {
    if (configCache) {
        return configCache;
    }

    const configPath = path.join(__dirname, '../config/documentPrefixes.json');

    try {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        configCache = JSON.parse(configContent);
        return configCache!;
    } catch (error) {
        console.error('Failed to load documentPrefixes.json:', error);
        // Return default config if file not found
        return {
            prefixes: {
                purchaseOrder: { codes: ['45'], label: 'Purchase Order', shortLabel: 'PO' },
                materialDocument: { codes: ['50'], label: 'Material Document', shortLabel: 'Mat Doc' },
                supplierInvoice: { codes: ['51'], label: 'Supplier Invoice', shortLabel: 'Invoice' }
            }
        };
    }
}

/**
 * Identify document type by analyzing the ID prefix
 * @param documentId - The document ID to identify (e.g., "4500000329")
 * @returns DocumentTypeResult with type info or unknown if not matched
 */
export function identifyDocumentType(documentId: string): DocumentTypeResult {
    if (!documentId || documentId.trim() === '') {
        return {
            type: 'unknown',
            label: 'Unknown',
            shortLabel: 'Unknown',
            isValid: false
        };
    }

    const config = loadConfig();
    const id = documentId.trim();

    // Check each document type's prefixes
    for (const [type, prefixConfig] of Object.entries(config.prefixes)) {
        for (const code of prefixConfig.codes) {
            if (id.startsWith(code)) {
                return {
                    type,
                    label: prefixConfig.label,
                    shortLabel: prefixConfig.shortLabel,
                    isValid: true
                };
            }
        }
    }

    // No match found
    return {
        type: 'unknown',
        label: 'Unknown Document Type',
        shortLabel: 'Unknown',
        isValid: false
    };
}

/**
 * Clear the config cache (useful for testing or when config changes)
 */
export function clearConfigCache(): void {
    configCache = null;
}

/**
 * Get all configured document types
 * @returns Array of document type info
 */
export function getAllDocumentTypes(): Array<{ type: string; label: string; codes: string[] }> {
    const config = loadConfig();
    return Object.entries(config.prefixes).map(([type, prefixConfig]) => ({
        type,
        label: prefixConfig.label,
        codes: prefixConfig.codes
    }));
}
