/**
 * AgentApprovalExample - Example implementation showing how agents can use the approval system
 * 
 * This example demonstrates the complete workflow from agent task creation
 * to user approval and task execution.
 */

import { agentApprovalHelper } from '../services/AgentApprovalHelper';
import { ApprovalSystemInitializer } from '../services/ApprovalSystemInitializer';

export class ExampleAgent {
  private agentId: string;
  private chatId: string;
  
  constructor(agentId: string, chatId: string) {
    this.agentId = agentId;
    this.chatId = chatId;
  }
  
  /**
   * Example: Agent wants to post a tweet
   */
  public async handleTweetRequest(userMessage: string): Promise<void> {
    try {
      // Analyze user message and prepare tweet content
      const tweetContent = this.generateTweetFromMessage(userMessage);
      
      // Check if this would require approval
      const needsApproval = agentApprovalHelper.checkNeedsApproval({
        agentId: this.agentId,
        chatId: this.chatId,
        taskName: 'Post Tweet',
        taskDescription: 'Post a tweet to social media',
        taskType: 'Tweet',
        draftContent: tweetContent,
        priority: 'medium',
                 handler: async (...args: unknown[]) => this.postTweet(args[0] as string),
         handlerArgs: [tweetContent]
      });
      
      if (needsApproval) {
        // Request approval from user
        console.log('🔐 Tweet requires approval, requesting permission...');
        
        const taskId = await agentApprovalHelper.requestTweetApproval(
          this.agentId,
          this.chatId,
          tweetContent
        );
        
        console.log(`📝 Approval request sent to chat. Task ID: ${taskId}`);
        console.log('⏳ Waiting for user approval...');
        
        // The approval will be handled by the chat UI
        // When approved, the task will be scheduled for execution
        
      } else {
        // No approval needed, post immediately
        console.log('✅ No approval required, posting tweet...');
        await this.postTweet(tweetContent);
      }
      
    } catch (error) {
      console.error('Error handling tweet request:', error);
    }
  }
  
  /**
   * Example: Agent wants to send a scheduled email
   */
  public async handleEmailRequest(emailData: {
    to: string;
    subject: string;
    body: string;
    sendAt?: string;
  }): Promise<void> {
    try {
      const scheduledTime = emailData.sendAt ? new Date(emailData.sendAt) : undefined;
      
      // Check if this would require approval
      const needsApproval = agentApprovalHelper.checkNeedsApproval({
        agentId: this.agentId,
        chatId: this.chatId,
        taskName: 'Send Email',
        taskDescription: `Send email to ${emailData.to}`,
        taskType: 'Email',
        draftContent: `To: ${emailData.to}\nSubject: ${emailData.subject}\n\n${emailData.body}`,
        scheduledTime,
        priority: 'medium',
                 handler: async (...args: unknown[]) => this.sendEmail(args[0]),
         handlerArgs: [emailData]
      });
      
      if (needsApproval) {
        console.log('🔐 Email requires approval, requesting permission...');
        
        const taskId = await agentApprovalHelper.requestEmailApproval(
          this.agentId,
          this.chatId,
          {
            to: emailData.to,
            subject: emailData.subject,
            body: emailData.body,
            scheduledTime
          }
        );
        
        console.log(`📧 Email approval request sent to chat. Task ID: ${taskId}`);
        
      } else {
        console.log('✅ No approval required, sending email...');
        await this.sendEmail(emailData);
      }
      
    } catch (error) {
      console.error('Error handling email request:', error);
    }
  }
  
  /**
   * Example: Agent processes user message and decides what actions to take
   */
  public async processUserMessage(userMessage: string): Promise<void> {
    console.log(`🤖 Agent ${this.agentId} processing message: "${userMessage}"`);
    
    // Simple intent detection (in real implementation, this would be more sophisticated)
    if (userMessage.toLowerCase().includes('tweet')) {
      if (userMessage.toLowerCase().includes('tomorrow at') || userMessage.toLowerCase().includes('schedule')) {
        // Scheduled tweet
        const scheduledTime = this.extractScheduledTime(userMessage);
        const tweetContent = this.generateTweetFromMessage(userMessage);
        
        const taskId = await agentApprovalHelper.requestApproval({
          agentId: this.agentId,
          chatId: this.chatId,
          taskName: 'Post Scheduled Tweet',
          taskDescription: `Post tweet at ${scheduledTime?.toLocaleString()}`,
          taskType: 'Tweet',
          draftContent: tweetContent,
          scheduledTime,
          priority: 'medium',
          handler: async (...args: unknown[]) => this.postTweet(args[0] as string),
          handlerArgs: [tweetContent]
        });
        
        console.log(`📅 Scheduled tweet approval request sent. Task ID: ${taskId}`);
      } else {
        await this.handleTweetRequest(userMessage);
      }
    } else if (userMessage.toLowerCase().includes('email')) {
      // Extract email details from message (simplified)
      const emailData = this.extractEmailData(userMessage);
      await this.handleEmailRequest(emailData);
    } else {
      console.log('💬 Regular conversation - no approval needed');
    }
  }
  
  /**
   * Helper: Generate tweet content from user message
   */
  private generateTweetFromMessage(message: string): string {
    // In a real implementation, this would use AI to generate appropriate tweet content
    const tweetContent = message.replace(/tweet about|post about|tweet/gi, '').trim();
    
    // Add some AI agent flair
    const variations = [
      `🚀 ${tweetContent} #AIAgents #FutureOfWork`,
      `💡 ${tweetContent} #Innovation #AI`,
      `🤖 ${tweetContent} #ArtificialIntelligence #Tech`,
      `✨ ${tweetContent} #Automation #Productivity`
    ];
    
    return variations[Math.floor(Math.random() * variations.length)];
  }
  
  /**
   * Helper: Extract scheduled time from message
   */
  private extractScheduledTime(message: string): Date | undefined {
    // Simplified time extraction (in real implementation, use proper NLP)
    if (message.includes('tomorrow at 10am')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      return tomorrow;
    }
    
    // Default to 1 hour from now
    const oneHourLater = new Date();
    oneHourLater.setHours(oneHourLater.getHours() + 1);
    return oneHourLater;
  }
  
  /**
   * Helper: Extract email data from message
   */
  private extractEmailData(message: string): {
    to: string;
    subject: string;
    body: string;
    sendAt?: string;
  } {
    // Simplified email extraction (in real implementation, use proper NLP)
    return {
      to: 'example@email.com',
      subject: 'Message from AI Agent',
      body: message,
      sendAt: undefined
    };
  }
  
  /**
   * Actual tweet posting implementation
   */
  private async postTweet(content: string): Promise<any> {
    console.log('📱 Posting tweet:', content);
    // In real implementation, this would call Twitter API
    return { success: true, tweetId: `tweet-${Date.now()}` };
  }
  
  /**
   * Actual email sending implementation
   */
  private async sendEmail(emailData: any): Promise<any> {
    console.log('📧 Sending email:', emailData);
    // In real implementation, this would call email service API
    return { success: true, messageId: `email-${Date.now()}` };
  }
}

/**
 * Example usage and testing
 */
export async function runApprovalExample(): Promise<void> {
  console.log('🚀 Starting Approval System Example\n');
  
  // Initialize the approval system (normally done at app startup)
  if (!ApprovalSystemInitializer.isInitialized()) {
    await ApprovalSystemInitializer.initialize({
      // In real app, these would be actual service instances
      schedulerManager: null, // Would be actual scheduler manager
      messagingService: null  // Would be actual messaging service
    });
  }
  
  // Create example agent
  const agent = new ExampleAgent('chloe-agent', 'chat-123');
  
  console.log('📝 Example 1: User asks for a tweet');
  await agent.processUserMessage('Can you tweet about the current state of AI agents?');
  
  console.log('\n📝 Example 2: User asks for a scheduled tweet');
  await agent.processUserMessage('Prepare a tweet about AI agents that we can post tomorrow at 10am');
  
  console.log('\n📝 Example 3: User asks for an email');
  await agent.processUserMessage('Send an email about our quarterly results');
  
  console.log('\n✅ Example complete! Check the console output above to see the approval workflow in action.');
  console.log('\n💡 In a real chat application:');
  console.log('   - Users would see approval UI in their chat messages');
  console.log('   - Clicking "Approve" would execute the scheduled task');
  console.log('   - Clicking "Reject" would cancel the task');
} 