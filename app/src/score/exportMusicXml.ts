export const MUSICXML_MIME = 'application/vnd.recordare.musicxml+xml'

export function musicXmlBlob(xml: string): Blob {
  return new Blob([xml], { type: MUSICXML_MIME })
}
