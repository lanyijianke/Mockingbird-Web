export interface SiteBrandConfig {
    brandName: string;
    siteName: string;
    alternateName: string;
    icpNumber: string;
    icpUrl: string;
    homeTitle: string;
    homeDescription: string;
    defaultDescription: string;
    serviceName: string;
}

function readConfiguredValue(...keys: string[]): string | undefined {
    for (const key of keys) {
        const value = process.env[key]?.trim();
        if (value) {
            return value;
        }
    }

    return undefined;
}

export function getSiteBrandConfig(): SiteBrandConfig {
    const brandName = readConfiguredValue('NEXT_PUBLIC_SITE_BRAND_NAME', 'SITE_BRAND_NAME') || '知更鸟';
    const siteName = readConfiguredValue('NEXT_PUBLIC_SITE_NAME', 'SITE_NAME') || '知更鸟知识库';
    const alternateName = readConfiguredValue('NEXT_PUBLIC_SITE_ALTERNATE_NAME', 'SITE_ALTERNATE_NAME') || 'Mockingbird Knowledge';
    const icpNumber = readConfiguredValue('NEXT_PUBLIC_SITE_ICP_NUMBER', 'SITE_ICP_NUMBER') || '冀ICP备2024081438号';
    const icpUrl = readConfiguredValue('NEXT_PUBLIC_SITE_ICP_URL', 'SITE_ICP_URL') || 'https://beian.miit.gov.cn/';
    const homeTitle = readConfiguredValue('NEXT_PUBLIC_SITE_HOME_TITLE', 'SITE_HOME_TITLE') || `${siteName} - 泛 AI 知识平台`;
    const homeDescription = readConfiguredValue('NEXT_PUBLIC_SITE_HOME_DESCRIPTION', 'SITE_HOME_DESCRIPTION')
        || '深度文章、提示词精选与实时热榜，助你立于 AI 前沿';
    const defaultDescription = readConfiguredValue('NEXT_PUBLIC_SITE_DEFAULT_DESCRIPTION', 'SITE_DEFAULT_DESCRIPTION')
        || `${siteName}：提供专业的 AI 教程、AI 实践案例、AI 提示词精选及 AI 工具大全。致力于打造全网最全的泛 AI 知识矩阵。`;
    const serviceName = readConfiguredValue('SITE_SERVICE_NAME', 'NEXT_PUBLIC_SITE_SERVICE_NAME') || `${siteName} Web`;

    return {
        brandName,
        siteName,
        alternateName,
        icpNumber,
        icpUrl,
        homeTitle,
        homeDescription,
        defaultDescription,
        serviceName,
    };
}
