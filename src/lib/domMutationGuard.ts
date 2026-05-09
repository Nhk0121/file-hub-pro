const PATCH_FLAG = '__taoyuanDmsDomMutationGuard__';

declare global {
  interface Window {
    [PATCH_FLAG]?: boolean;
  }
}

export const installDomMutationGuard = () => {
  if (typeof window === 'undefined' || typeof Node === 'undefined' || window[PATCH_FLAG]) return;

  window[PATCH_FLAG] = true;

  const originalRemoveChild = Node.prototype.removeChild;
  const originalInsertBefore = Node.prototype.insertBefore;

  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      return child;
    }

    return originalRemoveChild.call(this, child) as T;
  };

  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      return originalInsertBefore.call(this, newNode, null) as T;
    }

    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
};