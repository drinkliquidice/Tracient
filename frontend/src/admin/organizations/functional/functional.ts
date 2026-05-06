export function getMemberIdFromEndpoint(endpoint: string): string {
    const parts = endpoint.split('/');
    return parts[parts.length - 1];
}