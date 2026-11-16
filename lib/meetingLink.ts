// Link de reunião escrito na descrição ou no local do evento (Zoom, Teams etc.). Usado pelo site e pelo app.
export function extractExternalLink(description?: string | null, location?: string | null): string | undefined {
  const text = [description, location].filter(Boolean).join(' ')
  if (!text) return undefined

  const urlRegex = /https?:\/\/[^\s<>"',)]+/gi
  const matches = text.match(urlRegex)
  if (!matches) return undefined

  const meetingPatterns = [
    'zoom.us', 'teams.microsoft.com', 'webex.com', 'chime.aws',
    'bluejeans.com', 'gotomeeting.com', 'joinvirtualevent',
    'whereby.com', 'around.co', 'meet.jit.si',
  ]

  const meetingLink = matches.find((url) =>
    meetingPatterns.some((pattern) => url.toLowerCase().includes(pattern))
  )

  return meetingLink || matches[0]
}
