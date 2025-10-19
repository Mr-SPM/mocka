
// entrypoints/content/App.tsx
import { storage } from '#imports'
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
    Button,
    Card,
    Tree,
    Typography,
    Input,
    Modal,
    Form,
    Select,
    Space,
    Popconfirm,
    message,
    Switch
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { DataNode, EventDataNode } from 'antd/es/tree';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import logo from '~/assets/mocka_icon.svg'
import { STORAGE_KEY, MOCK_ENABLED_KEY } from '../../utils'

const { Title } = Typography;
const { Search } = Input;
const { TextArea } = Input;



// 树节点类型定义
interface ApiNode extends DataNode {
    children?: ApiNode[];
    domain?: string;
    disabled?: boolean;
    mockData?: Record<string, any> // 接口用
}


// 默认 Mock 数据
const defaultMockData: Record<string, any> = {
 
    code: 0,
    data: [
        { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' },
        { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user' },
        { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'user' },
    ],
    msg: 'success',
    timestamp: Date.now(),
}
        
    

// 默认树数据
const defaultTreeData: ApiNode[] = [
    {
        title: '默认分组',
        key: 'group:default',
        domain: 'www.google.com',
        selectable: false,
        disabled: true,
        children: [
            { title: '/api/user/list', key: 'api:group:default/api/user/list', isLeaf: true, mockData: defaultMockData },
        ],
    },
];



// 编辑表单数据类型
interface EditFormData {
    type: 'group' | 'api';
    title: string;
    url?: string;
    parentKey?: string;
    mockData?: string;
    domain?: string;
}

export interface AppRef {
    toggleOpen: () => void;
}

const App = forwardRef<AppRef>((_, ref) => {
    // 主要状态
    const [open, setOpen] = useState(false);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [searchValue, setSearchValue] = useState('');
    const [treeData, setTreeData] = useState<ApiNode[]>([]);
    const [mockEnabled, setMockEnabled] = useState<boolean>(false);

    useEffect(() => {
        storage.getItem<ApiNode[]>(STORAGE_KEY).then(value => {
            setTreeData(value || defaultTreeData)
        })
            storage.getItem<boolean>(MOCK_ENABLED_KEY).then(value => {
            setMockEnabled(value || false)
        })
    }, [])

    // 编辑状态
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingNode, setEditingNode] = useState<string | null>(null);
    const [editType, setEditType] = useState<'add-group' | 'add-api' | 'edit' | null>(null);
    const [resetConfirmVisible, setResetConfirmVisible] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [deleteNodeKey, setDeleteNodeKey] = useState<string | null>(null);

    const [form] = Form.useForm<EditFormData>();

    const apiMap = useMemo(() => treeData.reduce((acc, next) => {
            if (next.children) {
                for (const api of next.children) {
                    acc[api.key as string] = api.mockData
                }
            }
            return acc
        }, {} as Record<string ,any>)
    , [treeData])

    useImperativeHandle(ref, () => ({
        toggleOpen: () => setOpen(prev => !prev),
    }));

    // 保存到本地存储
    useEffect(() => {
        storage.setItem(STORAGE_KEY, treeData);
    }, [treeData]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // 筛选树数据
    const filteredTreeData = useMemo(() => {
        if (!searchValue.trim()) return treeData;

        const filterTree = (nodes: ApiNode[]): ApiNode[] => {
            return nodes.reduce<ApiNode[]>((acc, node) => {
                const titleMatch = node.title?.toString().toLowerCase().includes(searchValue.toLowerCase());

                if (node.children) {
                    const filteredChildren = filterTree(node.children);
                    if (filteredChildren.length > 0 || titleMatch) {
                        acc.push({
                            ...node,
                            children: filteredChildren.length > 0 ? filteredChildren : node.children,
                        });
                    }
                } else if (titleMatch) {
                    acc.push(node);
                }

                return acc;
            }, []);
        };

        return filterTree(treeData);
    }, [treeData, searchValue]);
    // JSON 内容
    const jsonContent = JSON.stringify(apiMap[selectedKey as string], null, 2)

    // 生成唯一 key
    const generateKey = (type: 'group' | 'api', title: string) => {
        if (type === 'api') {
            // 对于 API，直接使用路径作为 key（不添加时间戳）
            return `api:${title}`;
        } else {
            // 对于分组，添加时间戳确保唯一性
            const timestamp = Date.now();
            return `group:${title.replace(/\s+/g, '-').toLowerCase()}-${timestamp}`;
        }
    };

    // 查找节点
    const findNode = useCallback((nodes: ApiNode[], key: string): ApiNode | null => {
        for (const node of nodes) {
            if (node.key === key) return node;
            if (node.children) {
                const found = findNode(node.children, key);
                if (found) return found;
            }
        }
        return null;
    }, []);

    // 添加节点到树
    const addNodeToTree = useCallback((nodes: ApiNode[], parentKey: string | null, newNode: ApiNode): ApiNode[] => {
        if (!parentKey) {
            return [...nodes, newNode];
        }

        return nodes.map(node => {
            if (node.key === parentKey) {
                return {
                    ...node,
                    children: [...(node.children || []), newNode],
                };
            }
            if (node.children) {
                return {
                    ...node,
                    children: addNodeToTree(node.children, parentKey, newNode),
                };
            }
            return node;
        });
    }, []);

    // 更新树节点
    const updateNodeInTree = useCallback((nodes: ApiNode[], targetKey: string, updates: Partial<ApiNode>): ApiNode[] => {
        return nodes.map(node => {
            if (node.key === targetKey) {
                return { ...node, ...updates };
            }
            if (node.children) {
                return {
                    ...node,
                    children: updateNodeInTree(node.children, targetKey, updates),
                };
            }
            return node;
        });
    }, []);

    // 删除树节点
    const deleteNodeFromTree = useCallback((nodes: ApiNode[], targetKey: string): ApiNode[] => {
        return nodes.filter(node => {
            if (node.key === targetKey) return false;
            if (node.children) {
                node.children = deleteNodeFromTree(node.children, targetKey);
            }
            return true;
        });
    }, []);

    // 处理表单提交
    const handleFormSubmit = useCallback(async () => {
        try {
            const values = await form.validateFields();

            if (editType === 'add-group') {
                const newNode: ApiNode = {
                    title: values.title,
                    key: generateKey('group', values.title),
                    selectable: false,
                    children: [],
                    domain: values.domain
                };
                setTreeData(prev => addNodeToTree(prev, values.parentKey || null, newNode));
                message.success('分组添加成功');
            } else if (editType === 'add-api') {
                const apiKey = generateKey('api', (values.parentKey || '') +  (values.url || values.title));
                const newNode: ApiNode = {
                    title: values.url || values.title,
                    key: apiKey,
                    isLeaf: true,
                };
                try {
                    newNode.mockData = JSON.parse(values.mockData || '{ "code": 0, "data": {}, "msg": "success" }')
                }catch {
                    newNode.mockData = { code: 0, data: {}, msg: 'success' }
                }
                setTreeData(prev => addNodeToTree(prev, values.parentKey || null, newNode));

                message.success('接口添加成功');
            } else if (editType === 'edit' && editingNode) {
                setTreeData(prev => updateNodeInTree(prev, editingNode, { title: values.title }));

                if (values.mockData && editingNode.startsWith('api:')) {
                    try {
                        const parsedData = JSON.parse(values.mockData);
                         setTreeData(prev => updateNodeInTree(prev, editingNode, { mockData: parsedData }));
                    } catch (error) {
                        message.error('Mock 数据格式错误');
                        return;
                    }
                }
                message.success('更新成功');
            }

            setEditModalVisible(false);
            form.resetFields();
            setEditType(null);
            setEditingNode(null);
        } catch (error) {
            console.error('Form validation failed:', error);
        }
    }, [editType, editingNode, form, addNodeToTree, updateNodeInTree]);

    // 处理节点选择
    const handleSelect = (_: React.Key[], info: { node: any }) => {
        if (info.node.isLeaf && typeof info.node.key === 'string') {
            setSelectedKey(info.node.key);
        }
    };

    // 切换分组状态
    const toggleGroupEnabled = (value: boolean,node: ApiNode) => {
        setTreeData(prev => updateNodeInTree(prev, node.key as string, { disabled: value }));
    };

    const handleBackgroundClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            setOpen(false);
        }
    };

    if (!open) return null;

    return (
        <div
            onClick={handleBackgroundClick}
            style={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.4)',
                pointerEvents: 'auto',
                zIndex: 10000,
            }}
        >
            <Card
                title={
                    <Space align='center' style={{ width: '100%' }}>
                        <img src={logo} alt="log" width={36} height={36} />
                        <Title level={3} style={{ margin: 0, color: '#1890ff' }}>Mocka</Title>
                        <Button
                            size="small"
                            type={mockEnabled ? 'primary' : 'default'}
                            onClick={() => {
                                const newEnabled = !mockEnabled;
                                setMockEnabled(newEnabled);
                                storage.setItem(MOCK_ENABLED_KEY,newEnabled);
                                message.success(`MSW 已${newEnabled ? '启用' : '禁用'}`);
                            }}
                            style={{
                                borderColor: mockEnabled ? '#52c41a' : '#ff4d4f',
                                backgroundColor: mockEnabled ? '#52c41a' : 'transparent',
                                color: mockEnabled ? 'white' : '#ff4d4f'
                            }}
                        >
                            {mockEnabled ? '🟢 MSW 已启用' : '🔴 MSW 已禁用'}
                        </Button>
                        <Button
                            size="small"
                            danger
                            onClick={() => setResetConfirmVisible(true)}
                        >
                            重置数据
                        </Button>
                    </Space>
                }
                extra={
                    <Button type="text" onClick={() => setOpen(false)}>
                        ✕
                    </Button>
                }
                style={{
                    width: '85vw',
                    height: '85vh',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                }}
                styles={{
                    body: {
                        height: 'calc(85vh - 70px)',
                        padding: 0,
                        display: 'flex',
                    },
                }}
            >
                {/* 左侧树形结构 */}
                <div
                    style={{
                        width: 320,
                        borderRight: '1px solid #f0f0f0',
                        padding: 16,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {/* 顶部操作区 */}
                    <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
                        <Search
                            placeholder="搜索接口..."
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            style={{ width: '100%' }}
                        />
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Button
                                type="primary"
                                size="small"
                                onClick={() => {
                                    setEditType('add-group');
                                    setEditModalVisible(true);
                                    form.setFieldsValue({ type: 'group' });
                                }}
                            >
                                添加分组
                            </Button>
                            <Button
                                size="small"
                                onClick={() => {
                                    setEditType('add-api');
                                    setEditModalVisible(true);
                                    form.setFieldsValue({ type: 'api' });
                                }}
                            >
                                添加接口
                            </Button>
                        </Space>
                    </Space>

                    {/* 树形结构 */}
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        <Tree
                            className='my-tree'
                            treeData={filteredTreeData}
                            defaultExpandAll
                            onSelect={handleSelect}
                            selectedKeys={selectedKey ? [selectedKey] : []}
                            style={{ fontSize: 14 }}
                            titleRender={(node) => {
                                const isGroup = !node.isLeaf;
                                return (
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            width: '100%',
                                            userSelect: 'none'
                                        }}
                                    >
                                        <span
                                            style={{
                                                opacity: node.disabled ? 0.5 : 1,
                                                textDecoration: node.disabled ? 'line-through' : 'none'
                                            }}
                                        >
                                            {node.title as string }{node.domain ? `(${node.domain})` : ''}
                                        </span>
                                        {isGroup && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    icon={<PlusOutlined />}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditType('add-api');
                                                        setEditModalVisible(true);
                                                        form.setFieldsValue({
                                                            type: 'api',
                                                            parentKey: node.key as string
                                                        });
                                                    }}
                                                    style={{
                                                        color: '#1890ff',
                                                        padding: '0 4px',
                                                        height: 20,
                                                        minWidth: 20
                                                    }}
                                                    title="添加接口"
                                                />
                                                <Switch
                                                    size="small"
                                                    checked={!node.disabled}
                                                    onChange={(v) => toggleGroupEnabled(!v, node)}
                                                    style={{ marginLeft: 4 }}
                                                />
                                            </div>
                                        )}
                                        
                                    </div>
                                );
                            }}
                        />
                    </div>
                </div>

                {/* 右侧 JSON 展示区 */}
                <div
                    style={{
                        flex: 1,
                        padding: 16,
                        overflow: 'auto',
                        background: '#fafafa',
                    }}
                >
                    {selectedKey && (
                        <div style={{ marginBottom: 12 }}>
                            <Space>
                                <Button
                                    type="primary"
                                    size="small"
                                    onClick={() => {
                                        setEditType('edit');
                                        setEditingNode(selectedKey);
                                        setEditModalVisible(true);
                                        const node = findNode(treeData, selectedKey);
                                        form.setFieldsValue({
                                            title: node?.title,
                                            mockData: jsonContent
                                        });
                                    }}
                                >
                                    编辑数据
                                </Button>
                                <Button
                                    size="small"
                                    onClick={() => {
                                        navigator.clipboard.writeText(jsonContent);
                                        message.success('已复制到剪贴板');
                                    }}
                                >
                                    复制
                                </Button>
                                <Popconfirm
                                    title="确认删除"
                                    description={`确定要删除接口 "${findNode(treeData, selectedKey)?.title}" 吗？`}
                                    onConfirm={() => {
                                        const node = findNode(treeData, selectedKey);
                                        setTreeData(prev => deleteNodeFromTree(prev, selectedKey));
                                        message.success(`已删除接口 "${node?.title}"`);
                                    }}
                                    okText="确定"
                                    cancelText="取消"
                                    zIndex={2147483649}
                                    getPopupContainer={() => document.body}
                                >
                                    <Button
                                        size="small"
                                        danger
                                    >
                                        删除接口
                                    </Button>
                                </Popconfirm>
                            </Space>
                        </div>
                    )}
                    <SyntaxHighlighter
                        language="json"
                        style={oneDark}
                        customStyle={{
                            margin: 0,
                            borderRadius: 6,
                            fontSize: 14,
                            lineHeight: 1.5,
                        }}
                        showLineNumbers
                    >
                        {jsonContent}
                    </SyntaxHighlighter>
                </div>
            </Card>

            {/* 编辑模态框 */}
            <Modal
                title={
                    editType === 'add-group'
                        ? '添加分组'
                        : editType === 'add-api'
                            ? '添加接口'
                            : '编辑'
                }
                open={editModalVisible}
                onOk={handleFormSubmit}
                onCancel={() => {
                    setEditModalVisible(false);
                    form.resetFields();
                    setEditType(null);
                    setEditingNode(null);
                }}
                width={600}
                zIndex={2147483648}
                styles={{
                    body: { maxHeight: '70vh', overflow: 'auto' },
                    mask: { zIndex: 2147483647 }
                }}
                getContainer={() => document.body}
            >
                <Form
                    form={form}
                    layout="vertical"
                    style={{ marginTop: 16 }}
                >
                    <Form.Item
                        name="title"
                        label={editType === 'add-api' ? '接口名称' : '名称'}
                        rules={[{ required: true, message: '请输入名称' }]}
                    >
                        <Input placeholder="请输入名称" />
                    </Form.Item>

                    {editType === 'add-api' && (
                        <>
                            <Form.Item
                                name="parentKey"
                                label="所属分组"
                                rules={[{ required: true, message: '请选择分组' }]}
                            >
                                <Select placeholder="请选择分组">
                                    <Select.Option value="">根目录</Select.Option>
                                    {treeData.map((group) => (
                                        <Select.Option key={group.key} value={group.key}>
                                            {group.title}
                                        </Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>
                            <Form.Item
                                name="url"
                                label="接口路径"
                                rules={[{ required: true, message: '请输入接口路径' }]}
                            >
                                <Input placeholder="如: /api/user/list" />
                            </Form.Item>
                        </>
                    )}

                    {editType === 'add-group' && (<>
                        <Form.Item
                            name="domain"
                            label="生效域名"
                            initialValue={location.host}
                        >
                            <Input placeholder='请输入生效域名' /> 
                        </Form.Item>
                        <Form.Item
                            name="parentKey"
                            label="父级分组"
                        >
                            <Select placeholder="请选择父级分组（可选）">
                                <Select.Option value="">根目录</Select.Option>
                                {treeData.map((group) => (
                                    <Select.Option key={group.key} value={group.key}>
                                        {group.title}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                        </>
                    )}

                    {(editType === 'add-api' || (editType === 'edit' && editingNode?.startsWith('api:'))) && (
                        <Form.Item
                            name="mockData"
                            label="Mock 数据"
                            rules={[
                                {
                                    validator: (_, value) => {
                                        if (!value) return Promise.resolve();
                                        try {
                                            JSON.parse(value);
                                            return Promise.resolve();
                                        } catch {
                                            return Promise.reject(new Error('请输入有效的 JSON 格式'));
                                        }
                                    },
                                },
                            ]}
                        >
                            <TextArea
                                rows={12}
                                placeholder="请输入 JSON 格式的 Mock 数据"
                                style={{ fontFamily: 'Monaco, Consolas, monospace' }}
                            />
                        </Form.Item>
                    )}

                    <Form.Item name="parentKey" hidden>
                        <Input />
                    </Form.Item>

                    <Form.Item name="type" hidden>
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 重置确认模态框 */}
            <Modal
                title="重置所有数据"
                open={resetConfirmVisible}
                onOk={() => {
                    storage.removeItem(STORAGE_KEY);
                    setTreeData(defaultTreeData);
                    setSelectedKey(null);
                    setResetConfirmVisible(false);
                    message.success('数据已重置');
                }}
                onCancel={() => setResetConfirmVisible(false)}
                okText="确定重置"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                zIndex={2147483648}
                styles={{
                    mask: { zIndex: 2147483647 }
                }}
                getContainer={() => document.body}
            >
                <p>确定要清除所有 Mock 数据和树结构吗？此操作不可撤销。</p>
            </Modal>

            {/* 右键菜单删除确认模态框 */}
            <Modal
                title="确认删除"
                open={deleteConfirmVisible}
                onOk={() => {
                    if (deleteNodeKey) {
                        setTreeData(prev => deleteNodeFromTree(prev, deleteNodeKey));
                        message.success('删除成功');
                    }
                    setDeleteConfirmVisible(false);
                    setDeleteNodeKey(null);
                }}
                onCancel={() => {
                    setDeleteConfirmVisible(false);
                    setDeleteNodeKey(null);
                }}
                okText="确定删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                zIndex={2147483648}
                styles={{
                    mask: { zIndex: 2147483647 }
                }}
                getContainer={() => document.body}
            >
                <p>确定要删除 "{deleteNodeKey ? findNode(treeData, deleteNodeKey)?.title : ''}" 吗？</p>
            </Modal>
        </div>
    );
});

App.displayName = 'App';

export default App;


