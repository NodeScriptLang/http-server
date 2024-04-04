import { createMemberDecorator, findMembers } from 'mesh-decorators';
import { Mesh } from 'mesh-ioc';

const DECORATOR_NAME = '@nodescript/http/status-check';

export const statusCheck = createMemberDecorator(DECORATOR_NAME);

export async function invokeStatusChecks(mesh: Mesh) {
    const res: Record<string, string> = {};
    const refs = findMembers(DECORATOR_NAME, mesh);
    const promises = refs.map(ref => ref.target[ref.memberName]());
    const results = await Promise.all(promises);
    for (const [i, ref] of refs.entries()) {
        res[ref.target.constructor.name] = results[i];
    }
    return res;
}
