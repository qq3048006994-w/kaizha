import assert from 'node:assert/strict'
import test from 'node:test'
import { courts } from '../data/story.js'
import { characters } from '../data/characters.js'
import { evidence, evidenceLinks, CORE_EVIDENCE_IDS } from '../data/evidence.js'
import { REQUIRED_PROOF_FLAGS } from './endings.js'

test('all four courts have reachable, acyclic nodes and valid transitions', () => {
  assert.equal(courts.length, 4)
  const choiceIds = new Set()
  for (const [index, court] of courts.entries()) {
    const nodes = new Map(court.nodes.map(node => [node.id, node]))
    assert.equal(nodes.size, court.nodes.length, 'duplicate node id')
    const reached = new Set()
    function visit(id, active = new Set()) {
      assert.ok(nodes.has(id), `missing target ${id}`)
      assert.ok(!active.has(id), `cycle at ${id}`)
      if (reached.has(id)) return
      const node = nodes.get(id)
      assert.ok(characters[node.speaker], `unknown speaker ${node.speaker}`)
      assert.ok(node.text)
      const edges = node.choices || [node]
      if (node.choices) {
        assert.ok(node.choices.some(choice => !choice.proof?.length), `${id}: all choices could be locked`)
        for (const choice of node.choices) {
          assert.ok(!choiceIds.has(choice.id), `duplicate choice ${choice.id}`)
          choiceIds.add(choice.id)
          assert.ok(choice.label && choice.response)
          if (choice.finalChoice) assert.equal(index, 3)
        }
      }
      const nextActive = new Set([...active, id])
      for (const edge of edges) {
        assert.ok(edge.next === null || typeof edge.next === 'string', `missing next on ${id}`)
        if (edge.next !== null) visit(edge.next, nextActive)
        else if (index === 3) assert.ok(edge.finalChoice, 'fourth court must end with a verdict')
      }
      reached.add(id)
    }
    visit(court.startNode)
    assert.equal(reached.size, nodes.size, `${court.id}: unreachable nodes`)
  }
})

test('evidence references, link recipes and proof flags agree across the story', () => {
  const known = new Set(evidence.map(item => item.id))
  assert.equal(known.size, evidence.length)
  const awarded = new Set()
  const flags = new Set(evidenceLinks.map(link => link.flag))
  for (const court of courts) for (const node of court.nodes) for (const choice of node.choices || []) {
    for (const id of [...(choice.effects?.evidence || []), ...(choice.proof || [])]) assert.ok(known.has(id), id)
    for (const id of choice.effects?.evidence || []) awarded.add(id)
    for (const flag of choice.effects?.flags || []) flags.add(flag)
  }
  for (const id of CORE_EVIDENCE_IDS) assert.ok(awarded.has(id), `${id} cannot be acquired`)
  assert.equal(new Set(evidenceLinks.map(link => link.flag)).size, 3)
  for (const link of evidenceLinks) {
    assert.ok(link.evidence.length >= 2 && link.evidence.length <= 3)
    assert.equal(new Set(link.evidence).size, link.evidence.length)
    for (const id of link.evidence) assert.ok(known.has(id), id)
  }
  for (const flag of REQUIRED_PROOF_FLAGS) assert.ok(flags.has(flag), `${flag} cannot be obtained`)
})
