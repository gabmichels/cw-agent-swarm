import json
from pathlib import Path
from datetime import datetime
import uuid
import random

# Define paths for decision tree storage
DECISION_TREE_DIR = Path("./apps/agents/shared/memory/decision_trees")
DECISION_TREE_DIR.mkdir(parents=True, exist_ok=True)

class DecisionNode:
    """A node in a decision tree that helps agents make autonomous decisions."""
    
    def __init__(self, 
                 node_id=None, 
                 question=None, 
                 condition=None, 
                 action=None, 
                 success_node=None, 
                 failure_node=None,
                 options=None):
        """
        Initialize a decision node.
        
        Args:
            node_id: Unique identifier for this node
            question: Question to ask when evaluating this node
            condition: Condition to evaluate (if applicable)
            action: Action to take at this node (if applicable)
            success_node: ID of the node to go to on success/yes
            failure_node: ID of the node to go to on failure/no
            options: List of options with their target nodes (for multi-choice nodes)
        """
        self.node_id = node_id or str(uuid.uuid4())
        self.question = question
        self.condition = condition
        self.action = action
        self.success_node = success_node
        self.failure_node = failure_node
        self.options = options or []
        
    def to_dict(self):
        """Convert the node to a dictionary."""
        return {
            "id": self.node_id,
            "question": self.question,
            "condition": self.condition,
            "action": self.action,
            "success_node": self.success_node,
            "failure_node": self.failure_node,
            "options": self.options
        }
    
    @classmethod
    def from_dict(cls, data):
        """Create a node from a dictionary."""
        return cls(
            node_id=data.get("id"),
            question=data.get("question"),
            condition=data.get("condition"),
            action=data.get("action"),
            success_node=data.get("success_node"),
            failure_node=data.get("failure_node"),
            options=data.get("options", [])
        )

class DecisionTree:
    """A decision tree that helps agents make autonomous decisions."""
    
    def __init__(self, tree_id=None, name=None, description=None, root_node_id=None):
        """
        Initialize a decision tree.
        
        Args:
            tree_id: Unique identifier for this tree
            name: Name of the tree
            description: Description of what this tree helps decide
            root_node_id: ID of the root node
        """
        self.tree_id = tree_id or str(uuid.uuid4())
        self.name = name or f"Decision Tree {self.tree_id[:8]}"
        self.description = description or "A decision tree for agent decisions"
        self.root_node_id = root_node_id
        self.nodes = {}
        self.execution_history = []
        
    def add_node(self, node):
        """Add a node to the tree."""
        self.nodes[node.node_id] = node
        if len(self.nodes) == 1 and not self.root_node_id:
            self.root_node_id = node.node_id
        return node.node_id
    
    def execute(self, context=None):
        """
        Execute the decision tree with the given context.
        
        Args:
            context: Dictionary of context information
            
        Returns:
            Execution result with path and final action
        """
        if not self.root_node_id or not self.nodes:
            return {"error": "Decision tree is empty"}
        
        context = context or {}
        path = []
        current_node_id = self.root_node_id
        
        while current_node_id:
            current_node = self.nodes.get(current_node_id)
            if not current_node:
                break
            
            path.append({
                "node_id": current_node_id,
                "question": current_node.question,
                "action": current_node.action
            })
            
            # If it's an action node, execute it
            if current_node.action:
                # Record this execution in history
                self.execution_history.append({
                    "timestamp": datetime.now().isoformat(),
                    "node_id": current_node_id,
                    "action": current_node.action,
                    "context": context
                })
                
                # End the execution
                return {
                    "path": path,
                    "final_action": current_node.action,
                    "context": context
                }
            
            # Evaluate the condition if it exists
            if current_node.condition:
                try:
                    # Simple condition evaluation - in production this would be more sophisticated
                    condition_met = eval(current_node.condition, {"context": context})
                    current_node_id = current_node.success_node if condition_met else current_node.failure_node
                except Exception as e:
                    return {"error": f"Error evaluating condition: {str(e)}"}
            
            # Handle multi-option nodes
            elif current_node.options:
                # In automated execution, we'd need some logic to choose an option
                # For now, let's use the context to determine which option to take
                option_key = context.get("selected_option")
                
                if option_key is not None:
                    # Find the matching option
                    for option in current_node.options:
                        if option.get("key") == option_key:
                            current_node_id = option.get("target_node")
                            break
                    else:
                        # If no match found, use the first option as default
                        current_node_id = current_node.options[0].get("target_node") if current_node.options else None
                else:
                    # Without a selected option, use the first option as default
                    current_node_id = current_node.options[0].get("target_node") if current_node.options else None
            
            # Binary yes/no nodes
            else:
                # In automated execution, determine yes/no based on context
                # For demonstration, let's randomly choose a path
                decision = context.get("decision", random.choice([True, False]))
                current_node_id = current_node.success_node if decision else current_node.failure_node
        
        return {
            "path": path,
            "final_action": None,
            "context": context
        }
    
    def to_dict(self):
        """Convert the tree to a dictionary."""
        return {
            "id": self.tree_id,
            "name": self.name,
            "description": self.description,
            "root_node_id": self.root_node_id,
            "nodes": {node_id: node.to_dict() for node_id, node in self.nodes.items()},
            "execution_history": self.execution_history
        }
    
    @classmethod
    def from_dict(cls, data):
        """Create a tree from a dictionary."""
        tree = cls(
            tree_id=data.get("id"),
            name=data.get("name"),
            description=data.get("description"),
            root_node_id=data.get("root_node_id")
        )
        
        for node_id, node_data in data.get("nodes", {}).items():
            tree.nodes[node_id] = DecisionNode.from_dict(node_data)
        
        tree.execution_history = data.get("execution_history", [])
        
        return tree

def save_decision_tree(tree):
    """Save a decision tree to disk."""
    tree_file = DECISION_TREE_DIR / f"{tree.tree_id}.json"
    with open(tree_file, "w") as f:
        json.dump(tree.to_dict(), f, indent=2)

def load_decision_tree(tree_id):
    """Load a decision tree from disk."""
    tree_file = DECISION_TREE_DIR / f"{tree_id}.json"
    if not tree_file.exists():
        return None
    
    with open(tree_file, "r") as f:
        return DecisionTree.from_dict(json.load(f))

def list_decision_trees():
    """List all available decision trees."""
    trees = []
    for tree_file in DECISION_TREE_DIR.glob("*.json"):
        with open(tree_file, "r") as f:
            tree_data = json.load(f)
            trees.append({
                "id": tree_data.get("id"),
                "name": tree_data.get("name"),
                "description": tree_data.get("description")
            })
    
    return trees

def create_marketing_initiative_tree():
    """Create and save a decision tree for marketing initiative planning."""
    tree = DecisionTree(
        name="Marketing Initiative Planning",
        description="Decision tree for planning and executing marketing initiatives"
    )
    
    # Create root node
    root = DecisionNode(
        question="Is this a new marketing initiative or an existing one?",
        options=[
            {"key": "new", "text": "New Initiative", "target_node": "assess_audience"},
            {"key": "existing", "text": "Existing Initiative", "target_node": "evaluate_performance"}
        ]
    )
    root_id = tree.add_node(root)
    
    # Audience assessment node
    audience_node = DecisionNode(
        node_id="assess_audience",
        question="Have we defined our target audience for this initiative?",
        success_node="define_goals",
        failure_node="research_audience"
    )
    tree.add_node(audience_node)
    
    # Research audience action node
    research_node = DecisionNode(
        node_id="research_audience",
        action="Conduct audience research and create audience personas"
    )
    tree.add_node(research_node)
    
    # Define goals node
    goals_node = DecisionNode(
        node_id="define_goals",
        question="Do we have clear, measurable goals for this initiative?",
        success_node="resource_check",
        failure_node="set_goals"
    )
    tree.add_node(goals_node)
    
    # Set goals action node
    set_goals_node = DecisionNode(
        node_id="set_goals",
        action="Define SMART goals for the marketing initiative"
    )
    tree.add_node(set_goals_node)
    
    # Resource check node
    resource_node = DecisionNode(
        node_id="resource_check",
        question="Do we have the necessary resources (budget, team, tools) for this initiative?",
        success_node="create_plan",
        failure_node="resource_plan"
    )
    tree.add_node(resource_node)
    
    # Resource planning action node
    resource_plan_node = DecisionNode(
        node_id="resource_plan",
        action="Create a resource acquisition plan before proceeding"
    )
    tree.add_node(resource_plan_node)
    
    # Create plan action node
    create_plan_node = DecisionNode(
        node_id="create_plan",
        action="Create a detailed execution plan for the marketing initiative"
    )
    tree.add_node(create_plan_node)
    
    # Evaluate performance node
    evaluate_node = DecisionNode(
        node_id="evaluate_performance",
        question="Is the initiative meeting its performance targets?",
        success_node="optimize_initiative",
        failure_node="diagnose_issues"
    )
    tree.add_node(evaluate_node)
    
    # Optimize action node
    optimize_node = DecisionNode(
        node_id="optimize_initiative",
        action="Identify and implement optimizations to improve results further"
    )
    tree.add_node(optimize_node)
    
    # Diagnose issues action node
    diagnose_node = DecisionNode(
        node_id="diagnose_issues",
        action="Perform root cause analysis on underperforming metrics"
    )
    tree.add_node(diagnose_node)
    
    # Save the tree
    save_decision_tree(tree)
    
    return tree.tree_id

def create_content_creation_tree():
    """Create and save a decision tree for content creation."""
    tree = DecisionTree(
        name="Content Creation Process",
        description="Decision tree for the content creation workflow"
    )
    
    # Create root node
    root = DecisionNode(
        question="What type of content are we creating?",
        options=[
            {"key": "blog", "text": "Blog Post", "target_node": "blog_topic"},
            {"key": "social", "text": "Social Media", "target_node": "social_platform"},
            {"key": "video", "text": "Video", "target_node": "video_purpose"},
            {"key": "email", "text": "Email", "target_node": "email_audience"}
        ]
    )
    root_id = tree.add_node(root)
    
    # Blog topic node
    blog_topic_node = DecisionNode(
        node_id="blog_topic",
        question="Do we have a clear topic and keyword strategy?",
        success_node="blog_outline",
        failure_node="keyword_research"
    )
    tree.add_node(blog_topic_node)
    
    # Keyword research action
    keyword_node = DecisionNode(
        node_id="keyword_research",
        action="Conduct keyword research and select target keywords"
    )
    tree.add_node(keyword_node)
    
    # Blog outline action
    blog_outline_node = DecisionNode(
        node_id="blog_outline",
        action="Create a detailed outline for the blog post"
    )
    tree.add_node(blog_outline_node)
    
    # Social platform node
    social_platform_node = DecisionNode(
        node_id="social_platform",
        question="Which platform is the content for?",
        options=[
            {"key": "instagram", "text": "Instagram", "target_node": "insta_type"},
            {"key": "twitter", "text": "Twitter", "target_node": "twitter_content"},
            {"key": "linkedin", "text": "LinkedIn", "target_node": "linkedin_content"},
            {"key": "facebook", "text": "Facebook", "target_node": "fb_content"}
        ]
    )
    tree.add_node(social_platform_node)
    
    # Instagram type node
    insta_type_node = DecisionNode(
        node_id="insta_type",
        action="Create Instagram-specific visual content with appropriate hashtags"
    )
    tree.add_node(insta_type_node)
    
    # Twitter content action
    twitter_node = DecisionNode(
        node_id="twitter_content",
        action="Create concise Twitter content with relevant hashtags"
    )
    tree.add_node(twitter_node)
    
    # LinkedIn content action
    linkedin_node = DecisionNode(
        node_id="linkedin_content",
        action="Create professional LinkedIn content focused on industry insights"
    )
    tree.add_node(linkedin_node)
    
    # Facebook content action
    fb_node = DecisionNode(
        node_id="fb_content",
        action="Create engaging Facebook content with strong call-to-action"
    )
    tree.add_node(fb_node)
    
    # Video purpose node
    video_node = DecisionNode(
        node_id="video_purpose",
        action="Create a video script and production plan"
    )
    tree.add_node(video_node)
    
    # Email audience node
    email_node = DecisionNode(
        node_id="email_audience",
        action="Create an email marketing template with personalized content"
    )
    tree.add_node(email_node)
    
    # Save the tree
    save_decision_tree(tree)
    
    return tree.tree_id

# Initialize with sample trees if they don't exist
def initialize_decision_trees():
    """Initialize the decision trees directory with sample trees if empty."""
    if not list_decision_trees():
        create_marketing_initiative_tree()
        create_content_creation_tree()
        
# Call initialization
initialize_decision_trees() 
 