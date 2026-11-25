/** 한 줄에 4마디 배치 (화면 미리보기와 PDF가 함께 쓴다) */
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { measureCount, staffCount } from './pageLayout'
import { MEASURES_PER_LINE } from './pdfSettings'

/** 이 수 이상의 보표는 총보처럼 빽빽하게 본다 */
const CROWDED_STAVES = 6

/** 연주자가 헷갈리지 않게 3연음 숫자는 되풀이되어도 모두 적는다 */
export function showAllTupletNumbers(osmd: OpenSheetMusicDisplay) {
  osmd.EngravingRules.TupletNumberLimitConsecutiveRepetitions = false
}

/** 악보를 읽기(load) 전에 부른다 */
export function applyFourPerLine(osmd: OpenSheetMusicDisplay, xml: string) {
  const rules = osmd.EngravingRules
  // 쉬는 마디를 숫자로 묶으면 한 줄의 마디 수가 달라진다
  rules.AutoGenerateMultipleRestMeasuresFromRestMeasures = false
  rules.RenderXMeasuresPerLineAkaSystem = MEASURES_PER_LINE
  rules.StretchLastSystemLine = true // 마지막 줄도 폭을 채워 마침 세로줄이 오른쪽 끝에 오게 한다
  // 보표가 많으면 악보가 지나치게 작아지지 않게 음표 사이를 좁힌다 (보표가 적을 때 좁히면 음표가 겹친다)
  if (staffCount(xml) >= CROWDED_STAVES) {
    rules.VoiceSpacingMultiplierVexflow = 0.7
    rules.VoiceSpacingAddendVexflow = 2
  }
}

/** 그린 뒤, 4마디가 한 줄에 못 들어가 줄이 늘었는가 (그러면 더 작게 그려야 한다) */
export function linesOverflow(osmd: OpenSheetMusicDisplay, xml: string): boolean {
  const lines = osmd.GraphicSheet.MusicPages.reduce((a, p) => a + p.MusicSystems.length, 0)
  return lines > Math.ceil(measureCount(xml) / MEASURES_PER_LINE)
}
