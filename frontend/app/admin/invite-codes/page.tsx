'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  isAuthenticated,
  getInviteCodes,
  getInviteCodeRequests,
  approveInviteCodeRequest,
  rejectInviteCodeRequest,
  getInviteRelationsTree,
  type InviteCode,
  type InviteCodeRequest,
  type InviteCodeRelationNode
} from '@/lib/api';
import { AddressDisplay } from '@/lib/components/AddressDisplay';

type TabType = 'codes' | 'requests' | 'relations';

// Helper function to format date safely
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

export default function AdminInviteCodesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('requests');
  
  // Invite codes state
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [codesPage, setCodesPage] = useState(1);
  const [codesTotalPages, setCodesTotalPages] = useState(1);
  
  // Requests state
  const [requests, setRequests] = useState<InviteCodeRequest[]>([]);
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestsTotalPages, setRequestsTotalPages] = useState(1);
  
  // Relations tree state
  const [relationsTree, setRelationsTree] = useState<InviteCodeRelationNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<number | string>>(new Set());
  
  const [isLoading, setIsLoading] = useState(false);
  const [limit] = useState(20);

  useEffect(() => {
    if (isAuthenticated()) {
      if (activeTab === 'codes') {
        fetchInviteCodes();
      } else if (activeTab === 'requests') {
        fetchRequests();
      } else if (activeTab === 'relations') {
        fetchInviteRelations();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, codesPage, requestsPage]);

  const fetchInviteCodes = async () => {
    if (!isAuthenticated()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await getInviteCodes(codesPage, limit);
      setInviteCodes(response.data || []);
      setCodesTotalPages(response.totalPages || 1);
    } catch (error: unknown) {
      console.error('Failed to fetch invite codes:', error);
      const message = error instanceof Error ? error.message : '获取邀请码列表失败';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRequests = async () => {
    if (!isAuthenticated()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await getInviteCodeRequests(requestsPage, limit);
      setRequests(response.data || []);
      setRequestsTotalPages(response.totalPages || 1);
    } catch (error: unknown) {
      console.error('Failed to fetch requests:', error);
      const message = error instanceof Error ? error.message : '获取申请列表失败';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: number) => {
    if (!confirm('确定要批准这个邀请码申请吗？')) {
      return;
    }

    setIsLoading(true);
    try {
      await approveInviteCodeRequest(requestId);
      toast.success('邀请码申请已批准');
      await fetchRequests();
      await fetchInviteCodes();
    } catch (error: unknown) {
      console.error('Failed to approve request:', error);
      const message = error instanceof Error ? error.message : '批准申请失败';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    if (!confirm('确定要拒绝这个邀请码申请吗？')) {
      return;
    }

    setIsLoading(true);
    try {
      await rejectInviteCodeRequest(requestId);
      toast.success('邀请码申请已拒绝');
      await fetchRequests();
    } catch (error: unknown) {
      console.error('Failed to reject request:', error);
      const message = error instanceof Error ? error.message : '拒绝申请失败';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInviteRelations = async () => {
    if (!isAuthenticated()) {
      return;
    }

    setIsLoading(true);
    try {
      const tree = await getInviteRelationsTree();
      setRelationsTree(tree);
      // Expand all root nodes by default (only invite code nodes, not user nodes)
      const rootIds = new Set(
        tree
          .filter(node => node.type === 'inviteCode' && typeof node.id === 'number')
          .map(node => node.id as number)
      );
      setExpandedNodes(rootIds);
    } catch (error: unknown) {
      console.error('Failed to fetch invite relations:', error);
      const message = error instanceof Error ? error.message : '获取邀请关系失败';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleNode = (nodeId: number | string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderRelationNode = (node: InviteCodeRelationNode, depth: number = 0): React.ReactElement => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const indent = depth * 20;
    const isUserNode = node.type === 'user';

    return (
      <div key={node.id} className={`border-b border-gray-200 hover:bg-gray-50 ${isUserNode ? 'bg-blue-50/30' : ''}`}>
        <div
          className="flex items-center py-2.5 px-4"
          style={{ paddingLeft: `${12 + indent}px` }}
        >
          {/* 展开/折叠图标 */}
          <div className="w-6 flex-shrink-0">
            {hasChildren ? (
              <button
                onClick={() => toggleNode(node.id)}
                className="text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            ) : (
              <span className={isUserNode ? 'text-blue-400' : 'text-gray-300'}>
                {isUserNode ? '👤' : '•'}
              </span>
            )}
          </div>

          {isUserNode ? (
            // 用户节点显示
            <>
              {/* 用户标识 */}
              <div className="w-24 flex-shrink-0">
                <div className="text-sm font-medium text-blue-700">用户</div>
              </div>

              {/* 用户地址 */}
              <div className="w-32 flex-shrink-0">
                {node.userAddress ? (
                  <AddressDisplay address={node.userAddress} />
                ) : (
                  <span className="text-gray-400 text-xs">-</span>
                )}
              </div>

              {/* 父邀请码 */}
              <div className="w-24 flex-shrink-0">
                <span className="font-mono text-xs text-gray-500">
                  {node.parentInviteCodeId ? `ID:${node.parentInviteCodeId}` : '-'}
                </span>
              </div>

              {/* 状态 */}
              <div className="w-20 flex-shrink-0">
                <span className="text-xs text-gray-500">-</span>
              </div>

              {/* 使用次数 */}
              <div className="w-24 flex-shrink-0 text-sm text-gray-500 text-center">-</div>

              {/* 铸造数量 */}
              <div className="w-20 flex-shrink-0 text-sm text-blue-700 font-medium text-center">
                {node.mintedCount || 0}
              </div>

              {/* 使用邀请码铸造 */}
              <div className="w-24 flex-shrink-0 text-sm text-gray-500 text-center">-</div>

              {/* 返佣总量 */}
              <div className="w-24 flex-shrink-0 text-sm text-gray-500 text-center">-</div>

              {/* 层级/后代 */}
              <div className="flex-1 text-xs text-gray-500 text-right pr-2">
                <span>L{node.level}</span>
              </div>
            </>
          ) : (
            // 邀请码节点显示
            <>
              {/* 邀请码 */}
              <div className="w-24 flex-shrink-0">
                <div className="font-mono text-sm font-semibold text-gray-900">{node.code}</div>
              </div>

              {/* 所有者地址 */}
              <div className="w-32 flex-shrink-0">
                {node.applicantAddress ? (
                  <AddressDisplay address={node.applicantAddress} />
                ) : (
                  <span className="text-gray-400 text-xs">-</span>
                )}
              </div>

              {/* 父邀请码 */}
              <div className="w-24 flex-shrink-0">
                {node.parentInviteCode ? (
                  <span className="font-mono text-xs text-gray-500">{node.parentInviteCode.code}</span>
                ) : (
                  <span className="text-gray-400 text-xs">根节点</span>
                )}
              </div>

              {/* 状态 */}
              <div className="w-20 flex-shrink-0">
                <span className={`px-2 py-0.5 rounded text-xs ${
                  node.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : node.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {node.status === 'active' ? '有效' : node.status === 'pending' ? '待激活' : '已撤销'}
                </span>
              </div>

              {/* 使用次数 */}
              <div className="w-24 flex-shrink-0 text-sm text-gray-700 text-center">
                {node.usageCount || 0}
                {node.maxUses && <span className="text-gray-400"> / {node.maxUses}</span>}
              </div>

              {/* 铸造数量 */}
              <div className="w-20 flex-shrink-0 text-sm text-gray-700 font-medium text-center">
                {node.selfMintedCount || 0}
              </div>

              {/* 使用邀请码铸造 */}
              <div className="w-24 flex-shrink-0 text-sm text-gray-700 font-medium text-center">
                {node.inviteCodeMintedCount || 0}
              </div>

              {/* 返佣总量 */}
              <div className="w-24 flex-shrink-0 text-sm text-green-700 font-semibold text-center">
                {node.type === 'inviteCode' && node.totalReferralReward !== undefined
                  ? node.totalReferralReward.toFixed(2)
                  : '-'}
              </div>

              {/* 层级/后代 */}
              <div className="flex-1 text-xs text-gray-500 text-right pr-2">
                <span>L{node.level}</span>
                {node.descendantCount > 0 && (
                  <span className="ml-2">↓{node.descendantCount}</span>
                )}
              </div>
            </>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderRelationNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">邀请码管理</h1>
          <p className="mt-1 text-sm text-gray-600">审核和管理邀请码</p>
        </div>

        {/* 标签页 */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('requests')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'requests'
                  ? 'border-[#E5F240] text-[#E5F240]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              申请记录
            </button>
            <button
              onClick={() => setActiveTab('codes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'codes'
                  ? 'border-[#E5F240] text-[#E5F240]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              邀请码列表
            </button>
            <button
              onClick={() => setActiveTab('relations')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'relations'
                  ? 'border-[#E5F240] text-[#E5F240]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              邀请关系
            </button>
          </nav>
        </div>

        {/* 申请记录表格 */}
        {activeTab === 'requests' && (
          <>
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold">申请记录</h2>
              <button
                onClick={fetchRequests}
                disabled={isLoading}
                className="px-4 py-2 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50"
              >
                {isLoading ? '加载中...' : '刷新'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">ID</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">申请人地址</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">推荐人邀请码</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">备注</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">状态</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">创建时间</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">审核时间</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                        {isLoading ? '加载中...' : '暂无申请记录'}
                      </td>
                    </tr>
                  ) : (
                    requests.map((request) => (
                      <tr key={request.id}>
                        <td className="border border-gray-300 px-4 py-2">{request.id}</td>
                        <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                          {request.applicantAddress.slice(0, 6)}...{request.applicantAddress.slice(-4)}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {request.referrerInviteCode ? (
                            <span className="font-mono text-sm">{request.referrerInviteCode.code}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-sm">
                          {request.note ? (
                            <span className="text-gray-700" title={request.note}>
                              {request.note.length > 30 ? `${request.note.slice(0, 30)}...` : request.note}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <span className={`px-2 py-1 rounded text-sm ${
                            request.status === 'approved' || request.status === 'auto_approved'
                              ? 'bg-green-100 text-green-800'
                              : request.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : request.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {request.status === 'approved' ? '已批准' : 
                             request.status === 'auto_approved' ? '自动批准' :
                             request.status === 'pending' ? '待审核' : 
                             request.status === 'rejected' ? '已拒绝' : request.status}
                          </span>
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-sm">
                          {formatDate(request.createdAt)}
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-sm">
                          {formatDate(request.reviewedAt)}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {request.status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveRequest(request.id)}
                                disabled={isLoading}
                                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 text-sm"
                              >
                                批准
                              </button>
                              <button
                                onClick={() => handleRejectRequest(request.id)}
                                disabled={isLoading}
                                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 text-sm"
                              >
                                拒绝
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 申请记录分页 */}
            {requestsTotalPages > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={() => setRequestsPage(p => Math.max(1, p - 1))}
                  disabled={requestsPage === 1 || isLoading}
                  className="px-4 py-2 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="px-4 py-2">
                  第 {requestsPage} / {requestsTotalPages} 页
                </span>
                <button
                  onClick={() => setRequestsPage(p => Math.min(requestsTotalPages, p + 1))}
                  disabled={requestsPage >= requestsTotalPages || isLoading}
                  className="px-4 py-2 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}

        {/* 邀请码列表 */}
        {activeTab === 'codes' && (
          <>
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold">邀请码列表</h2>
            <button
              onClick={fetchInviteCodes}
              disabled={isLoading}
              className="px-4 py-2 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50"
            >
              {isLoading ? '加载中...' : '刷新'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left">ID</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">邀请码</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">所有者</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">使用次数</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">状态</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">创建时间</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {inviteCodes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                      {isLoading ? '加载中...' : '暂无邀请码'}
                    </td>
                  </tr>
                ) : (
                  inviteCodes.map((code) => (
                    <tr key={code.id}>
                      <td className="border border-gray-300 px-4 py-2">{code.id}</td>
                      <td className="border border-gray-300 px-4 py-2 font-mono">{code.code}</td>
                      <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                        {(() => {
                          const address = code.applicantAddress || code.ownerAddress;
                          return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : <span className="text-gray-400">-</span>;
                        })()}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        {code.usageCount ?? code.currentUses ?? 0} {code.maxUses ? `/ ${code.maxUses}` : ''}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <span className={`px-2 py-1 rounded text-sm ${
                          code.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : code.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {code.status === 'active' ? '有效' : code.status === 'pending' ? '待铸造后激活' : '已撤销'}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        {formatDate(code.createdAt)}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        -
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

            {/* 邀请码分页 */}
            {codesTotalPages > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={() => setCodesPage(p => Math.max(1, p - 1))}
                  disabled={codesPage === 1 || isLoading}
                  className="px-4 py-2 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="px-4 py-2">
                  第 {codesPage} / {codesTotalPages} 页
                </span>
                <button
                  onClick={() => setCodesPage(p => Math.min(codesTotalPages, p + 1))}
                  disabled={codesPage >= codesTotalPages || isLoading}
                  className="px-4 py-2 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}

        {/* 邀请关系树 */}
        {activeTab === 'relations' && (
          <>
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold">邀请关系列表</h2>
              <button
                onClick={fetchInviteRelations}
                disabled={isLoading}
                className="px-4 py-2 bg-[#E5F240] text-black rounded-lg hover:bg-[#D4E238] disabled:opacity-50"
              >
                {isLoading ? '加载中...' : '刷新'}
              </button>
            </div>

            {isLoading && relationsTree.length === 0 ? (
              <div className="text-center py-8 text-gray-500">加载中...</div>
            ) : relationsTree.length === 0 ? (
              <div className="text-center py-8 text-gray-500">暂无邀请关系数据</div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-100 border-b border-gray-200 px-4 py-3">
                  <div className="flex items-center text-xs font-semibold text-gray-700">
                    <div className="w-6 flex-shrink-0"></div>
                    <div className="w-24 flex-shrink-0">邀请码</div>
                    <div className="w-32 flex-shrink-0">所有者地址</div>
                    <div className="w-24 flex-shrink-0">父邀请码</div>
                    <div className="w-20 flex-shrink-0">状态</div>
                    <div className="w-24 flex-shrink-0 text-center">用户数</div>
                    <div className="w-20 flex-shrink-0 text-center">自身铸造</div>
                    <div className="w-24 flex-shrink-0 text-center">下级铸造</div>
                    <div className="w-24 flex-shrink-0 text-center">返佣总量</div>
                    <div className="flex-1 text-right pr-2">层级/后代</div>
                  </div>
                </div>
                <div className="max-h-[600px] overflow-y-auto">
                  {relationsTree.map((node) => renderRelationNode(node))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}





