from setuptools import setup, find_packages

setup(
    name="crowd-wisdom",
    version="0.1.0",
    packages=find_packages() + ['apps', 'apps.agents', 'apps.agents.shared'],
    install_requires=[
        "langchain-openai",
        "python-dotenv",
        "requests",
    ],
) 
 