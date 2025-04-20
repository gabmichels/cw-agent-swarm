from typing import Dict
from datetime import datetime, timedelta

class ReflectionSystem:
    def generate_concept_reflection(self, concept_name: str) -> Dict:
        """
        Generate a reflection focused on a specific concept.
        
        Args:
            concept_name: The concept to reflect on
            
        Returns:
            The generated reflection
        """
        # Get memories related to this concept
        memory_ids = concept_memory.get_memories_for_concept(concept_name)
        memories = [episodic_memory.get_memory(mid) for mid in memory_ids if episodic_memory.get_memory(mid)]
        
        if not memories:
            return self.add_reflection(
                insight=f"No memories found related to concept: {concept_name}",
                related_concepts=[concept_name, "concept_reflection"],
                metadata={"reflection_type": "concept", "concept": concept_name}
            )
        
        # Get related concepts
        related_concept_names = concept_memory.get_related_concepts(concept_name)
        
        # Use the memory analyzer
        analysis_results = memory_analyzer.analyze_memories(
            memories=memories,
            analysis_type="conceptual",
            focus_query=f"What insights can be gained about {concept_name}?"
        )
        
        # Create the concept reflection
        concept_summary = f"Concept Reflection - {concept_name}: "
        concept_summary += memory_analyzer.generate_summary(memories)
        
        insights = analysis_results.get("insights", [])
        if insights:
            concept_summary += "\n\nInsights:\n- " + "\n- ".join(insights)
            
        if related_concept_names:
            concept_summary += f"\n\nRelated concepts: {', '.join(related_concept_names)}"
        
        # Add concept-specific related concepts
        related_concepts = [concept_name, "concept_reflection"]
        for rc in related_concept_names[:5]:  # Limit to 5 related concepts
            related_concepts.append(rc)
        
        return self.add_reflection(
            insight=concept_summary,
            source_memory_ids=[m["id"] for m in memories],
            related_concepts=related_concepts,
            metadata={
                "reflection_type": "concept",
                "concept": concept_name,
                "memory_count": len(memories),
                "related_concepts": related_concept_names
            }
        )
        
    def generate_weekly_reflection(self, publish_to_coda: bool = False, 
                                notify_discord: bool = False, 
                                discord_webhook: str = "") -> Dict:
        """
        Generate a weekly reflection and optionally publish it to Coda.
        
        Summarizes activities, insights, and progress from the past week,
        and can publish the results to Coda for team collaboration.
        
        Args:
            publish_to_coda: Whether to publish the reflection to Coda
            notify_discord: Whether to send a Discord notification
            discord_webhook: Discord webhook URL for notifications
            
        Returns:
            The generated reflection
        """
        # Focus on the last 7 days of memories
        one_week_ago = (datetime.now() - timedelta(days=7)).isoformat()
        weekly_memories = episodic_memory.get_memories_by_timeframe(start_time=one_week_ago)
        
        if not weekly_memories:
            reflection = self.add_reflection(
                insight="No significant activities found in the last week.",
                related_concepts=["weekly_reflection"],
                metadata={"reflection_type": "weekly"}
            )
        else:
            # Use the memory analyzer for a comprehensive analysis
            analysis_results = memory_analyzer.analyze_memories(
                memories=weekly_memories,
                analysis_type="temporal",
                focus_query="What were the key accomplishments, challenges, and insights from the past week?"
            )
            
            # Create the weekly summary using the analysis results
            weekly_summary = memory_analyzer.generate_summary(weekly_memories)
            
            # Extract key topics and entities
            entities = memory_analyzer.extract_key_entities(weekly_memories)
            
            # Get key accomplishments and challenges
            insights = []
            accomplishments = []
            challenges = []
            
            for insight in analysis_results.get("insights", []):
                insights.append(insight)
                if "accomplish" in insight.lower() or "success" in insight.lower():
                    accomplishments.append(insight)
                elif "challeng" in insight.lower() or "difficult" in insight.lower():
                    challenges.append(insight)
            
            # Format the weekly reflection with detailed sections
            now = datetime.now()
            week_number = now.isocalendar()[1]
            week_start = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")
            week_end = (now - timedelta(days=now.weekday()-4)).strftime("%Y-%m-%d")
            
            weekly_reflection = f"# Weekly Reflection: Week {week_number} ({week_start} to {week_end})\n\n"
            
            # Add summary section
            weekly_reflection += f"## Summary\n{weekly_summary}\n\n"
            
            # Add accomplishments section
            weekly_reflection += "## Key Accomplishments\n"
            if accomplishments:
                for item in accomplishments:
                    weekly_reflection += f"- {item}\n"
            else:
                weekly_reflection += "- No major accomplishments identified this week\n"
            weekly_reflection += "\n"
            
            # Add challenges section
            weekly_reflection += "## Challenges\n"
            if challenges:
                for item in challenges:
                    weekly_reflection += f"- {item}\n"
            else:
                weekly_reflection += "- No significant challenges identified this week\n"
            weekly_reflection += "\n"
            
            # Add general insights section
            weekly_reflection += "## Additional Insights\n"
            if insights:
                filtered_insights = [i for i in insights if i not in accomplishments and i not in challenges]
                if filtered_insights:
                    for item in filtered_insights:
                        weekly_reflection += f"- {item}\n"
                else:
                    weekly_reflection += "- No additional insights for this week\n"
            else:
                weekly_reflection += "- No additional insights for this week\n"
            weekly_reflection += "\n"
            
            # Add key topics
            if entities:
                weekly_reflection += f"## Key Topics\n{', '.join(entities)}\n\n"
            
            # Add next steps
            weekly_reflection += "## Looking Ahead\n"
            weekly_reflection += "Areas to focus on next week based on this reflection:\n"
            
            # Generate focus areas for next week based on challenges and insights
            if challenges:
                weekly_reflection += f"- Address challenge: {challenges[0]}\n"
            
            if insights:
                weekly_reflection += f"- Follow up on insight: {insights[0]}\n"
            
            weekly_reflection += "- Continue monitoring key topics and trends\n"
            
            # Create related concepts
            related_concepts = ["weekly_reflection", "time_management", "progress_review"]
            for entity in entities[:5]:  # Limit to 5 entities
                related_concepts.append(entity)
            
            # Add the reflection
            reflection = self.add_reflection(
                insight=weekly_reflection,
                source_memory_ids=[m["id"] for m in weekly_memories],
                related_concepts=related_concepts,
                metadata={
                    "reflection_type": "weekly",
                    "week_number": week_number,
                    "week_start": week_start,
                    "week_end": week_end,
                    "memory_count": len(weekly_memories),
                    "entities": entities
                }
            )
        
        # Publish to Coda if requested
        if publish_to_coda:
            try:
                from apps.agents.shared.tools.coda_reflection_tool import publish_reflection_to_coda
                
                # Extract tags from related concepts
                tags = ", ".join(reflection.get("related_concepts", []))
                
                # Publish to Coda
                coda_result = publish_reflection_to_coda(
                    summary=reflection["content"],
                    tags=tags,
                    notify_discord=notify_discord,
                    discord_webhook=discord_webhook,
                    include_in_weekly_section=True
                )
                
                # Update the reflection metadata with Coda information
                reflection["metadata"]["coda_published"] = True
                reflection["metadata"]["coda_result"] = str(coda_result)
                self._save_reflections()
                
            except Exception as e:
                import logging
                logging.error(f"Error publishing reflection to Coda: {str(e)}")
                reflection["metadata"]["coda_published"] = False
                reflection["metadata"]["coda_error"] = str(e)
                self._save_reflections()
        
        return reflection

# Create a global instance for easy import
reflection_system = ReflectionSystem() 