from fundchain.app import create_app
from fundchain.config import get_settings

app = create_app(get_settings())
