"""
健康檢查與基本端點測試
"""
import pytest
from httpx import AsyncClient


class TestHealthCheck:
    """測試健康檢查端點"""
    
    @pytest.mark.asyncio
    async def test_root_endpoint(self, client: AsyncClient):
        """測試根路徑"""
        response = await client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "version" in data
        assert data["docs"] == "/docs"
    
    @pytest.mark.asyncio
    async def test_health_check(self, client: AsyncClient):
        """測試健康檢查端點"""
        response = await client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "healthy"
        assert "database" in data


class TestAPIDocumentation:
    """測試 API 文件端點"""
    
    @pytest.mark.asyncio
    async def test_swagger_docs(self, client: AsyncClient):
        """測試 Swagger 文件頁面"""
        response = await client.get("/docs")
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_redoc(self, client: AsyncClient):
        """測試 ReDoc 文件頁面"""
        response = await client.get("/redoc")
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_openapi_json(self, client: AsyncClient):
        """測試 OpenAPI JSON"""
        response = await client.get("/openapi.json")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "openapi" in data
        assert "info" in data
        assert data["info"]["title"] == "Emogo Backend API"
