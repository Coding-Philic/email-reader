import { StateGraph, END } from '@langchain/langgraph';
import { EmailAgentState } from './state';
import { classifyNode } from './nodes/classify.node';
import { decideActionNode, routeAction } from './nodes/decide-action.node';
import { draftReplyNode } from './nodes/draft-reply.node';
import { finalizeNode } from './nodes/finalize.node';

export function buildEmailClassifierGraph() {
  const graph = new StateGraph(EmailAgentState)
    .addNode('classify', classifyNode)
    .addNode('decide_action', decideActionNode)
    .addNode('draft_reply', draftReplyNode)
    .addNode('finalize', finalizeNode)

    // Entry point
    .addEdge('__start__', 'classify')

    // After classification, decide action
    .addEdge('classify', 'decide_action')

    // Conditional routing based on action
    .addConditionalEdges('decide_action', routeAction, {
      draft_reply: 'draft_reply',
      finalize: 'finalize',
    })

    // After drafting reply, finalize
    .addEdge('draft_reply', 'finalize')

    // Finalize to end
    .addEdge('finalize', END);

  return graph.compile();
}
