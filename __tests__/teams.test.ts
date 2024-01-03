import {getTeamLabel} from '../src/teams'

test('Should return an empty array if the author is not in a team', () => {
  // Given
  const author = '@Anakin'
  const labelGlobs = new Map<string, string[]>()
  labelGlobs.set('TeamOne', [])

  // When
  const output = getTeamLabel(labelGlobs, author)

  // Expect
  expect(output).toEqual([])
})

test('Should add team label when the author is found', () => {
  // Given
  const author = '@Anakin'
  const labelGlobs = new Map<string, string[]>()
  labelGlobs.set('LightSide', ['@Yoda', '@Anakin'])

  // When
  const output = getTeamLabel(labelGlobs, author)

  // Expect
  expect(output).toEqual(['LightSide'])
})

test('Should be able to detect users with different username casings', () => {
  // Given
  const author = '@Anakin'
  const labelGlobs = new Map<string, string[]>()
  labelGlobs.set('LightSide', ['@Yoda', '@ANAKIN'])

  // When
  const output = getTeamLabel(labelGlobs, author)

  // Expect
  expect(output).toEqual(['LightSide'])
})

test('Should be able to detect when a user is in multiple teams', () => {
  // Given
  const author = '@Anakin'
  const labelGlobs = new Map<string, string[]>()
  labelGlobs.set('LightSide', ['@Yoda', '@Anakin'])
  labelGlobs.set('DarkSide', ['@Palpatine', '@Anakin'])

  // When
  const output = getTeamLabel(labelGlobs, author)

  // Expect
  expect(output).toEqual(['LightSide', 'DarkSide'])
})
